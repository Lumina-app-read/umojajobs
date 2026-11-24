import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AdminCatalogResponse,
  CATALOG_LIMITS,
  type CategoryInput,
  type CategoryUpdateInput,
  ERROR_CODES,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { type ClientInfo } from '../common/http/app-request';
import { type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventsService } from '../security-events/security-events.service';
import { categorySlug } from './category-slug';

type Tx = Prisma.TransactionClient;

/** Les modifications du catalogue se suivent une à une : ordre, doublons et dernier actif. */
const CATALOG_LOCK = 4_610_222;
const ORDER_STEP = 10;

/**
 * Catégories et pays. Rien n'est jamais supprimé : une catégorie ou un pays désactivé disparaît des
 * formulaires et des filtres, mais les comptes et les offres qui l'utilisent le gardent.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  async get(): Promise<AdminCatalogResponse> {
    const [categories, countries] = await Promise.all([
      this.prisma.jobCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          slug: true,
          nameFr: true,
          nameEn: true,
          isActive: true,
          _count: { select: { offers: true } },
        },
      }),
      this.prisma.country.findMany({
        orderBy: { iso2: 'asc' },
        select: {
          iso2: true,
          nameFr: true,
          nameEn: true,
          flagEmoji: true,
          dialCode: true,
          currencyCode: true,
          isActive: true,
          _count: { select: { users: true, jobOffers: true } },
        },
      }),
    ]);
    return {
      categories: categories.map(({ _count, ...category }) => ({
        ...category,
        offers: _count.offers,
      })),
      countries: countries.map(({ _count, ...country }) => ({
        ...country,
        users: _count.users,
        offers: _count.jobOffers,
      })),
    };
  }

  async createCategory(
    auth: AuthContext,
    input: CategoryInput,
    client: ClientInfo,
  ): Promise<AdminCatalogResponse> {
    await this.change(auth, client, async (tx) => {
      const existing = await tx.jobCategory.findMany({ select: { slug: true, sortOrder: true } });
      if (existing.length >= CATALOG_LIMITS.categoriesMax) {
        throw new UnprocessableEntityException({ code: ERROR_CODES.CATEGORY_DUPLICATE });
      }
      await this.assertUniqueNames(tx, input, null);
      const slug = categorySlug(input.nameEn, new Set(existing.map((row) => row.slug)));
      const created = await tx.jobCategory.create({
        data: {
          slug,
          ...input,
          sortOrder: Math.max(0, ...existing.map((row) => row.sortOrder)) + ORDER_STEP,
        },
      });
      return { target: 'category', id: created.id, before: null, after: { slug, ...input } };
    });
    return this.get();
  }

  async updateCategory(
    auth: AuthContext,
    id: string,
    input: CategoryUpdateInput,
    client: ClientInfo,
  ): Promise<AdminCatalogResponse> {
    await this.change(auth, client, async (tx) => {
      const current = await tx.jobCategory.findUnique({
        where: { id },
        select: { nameFr: true, nameEn: true, isActive: true },
      });
      if (!current) throw new NotFoundException({ code: ERROR_CODES.CATEGORY_NOT_FOUND });
      const after = {
        nameFr: input.nameFr ?? current.nameFr,
        nameEn: input.nameEn ?? current.nameEn,
        isActive: input.isActive ?? current.isActive,
      };
      await this.assertUniqueNames(tx, after, id);
      if (current.isActive && !after.isActive) {
        const others = await tx.jobCategory.count({ where: { id: { not: id }, isActive: true } });
        if (others === 0) throw new ConflictException({ code: ERROR_CODES.CATALOG_LAST_ACTIVE });
      }
      await tx.jobCategory.update({ where: { id }, data: after });
      return { target: 'category', id, before: current, after };
    });
    return this.get();
  }

  async orderCategories(
    auth: AuthContext,
    ids: string[],
    client: ClientInfo,
  ): Promise<AdminCatalogResponse> {
    await this.change(auth, client, async (tx) => {
      const existing = await tx.jobCategory.findMany({
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      const wanted = new Set(ids);
      // L'ordre porte sur toutes les catégories : sinon, la liste affichée a changé.
      if (
        wanted.size !== ids.length ||
        wanted.size !== existing.length ||
        existing.some((row) => !wanted.has(row.id))
      ) {
        throw new ConflictException({ code: ERROR_CODES.CATEGORY_ORDER_CONFLICT });
      }
      for (const [index, id] of ids.entries()) {
        await tx.jobCategory.update({ where: { id }, data: { sortOrder: index * ORDER_STEP } });
      }
      return {
        target: 'category_order',
        id: null,
        before: existing.map((row) => row.id),
        after: ids,
      };
    });
    return this.get();
  }

  async setCountryActive(
    auth: AuthContext,
    iso2: string,
    isActive: boolean,
    client: ClientInfo,
  ): Promise<AdminCatalogResponse> {
    await this.change(auth, client, async (tx) => {
      const current = await tx.country.findUnique({
        where: { iso2 },
        select: { isActive: true },
      });
      if (!current) throw new NotFoundException({ code: ERROR_CODES.COUNTRY_NOT_FOUND });
      if (current.isActive && !isActive) {
        const others = await tx.country.count({ where: { iso2: { not: iso2 }, isActive: true } });
        if (others === 0) throw new ConflictException({ code: ERROR_CODES.CATALOG_LAST_ACTIVE });
      }
      await tx.country.update({ where: { iso2 }, data: { isActive } });
      return { target: 'country', id: iso2, before: current, after: { isActive } };
    });
    return this.get();
  }

  /** Modification sous verrou, journalisée dans la même transaction avec les valeurs avant et après. */
  private async change(
    auth: AuthContext,
    client: ClientInfo,
    action: (tx: Tx) => Promise<{
      target: string;
      id: string | null;
      before: Prisma.InputJsonValue | null;
      after: Prisma.InputJsonValue;
    }>,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CATALOG_LOCK})`;
      const change = await action(tx);
      await this.securityEvents.record(
        {
          type: 'catalog_changed',
          userId: auth.user.id,
          client,
          metadata: { ...change, actorRoles: [...auth.roles] },
        },
        tx,
      );
    });
  }

  private async assertUniqueNames(
    tx: Tx,
    names: CategoryInput,
    exceptId: string | null,
  ): Promise<void> {
    const duplicate = await tx.jobCategory.findFirst({
      where: {
        ...(exceptId && { id: { not: exceptId } }),
        OR: [
          { nameFr: { equals: names.nameFr, mode: 'insensitive' } },
          { nameEn: { equals: names.nameEn, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException({ code: ERROR_CODES.CATEGORY_DUPLICATE });
  }
}
