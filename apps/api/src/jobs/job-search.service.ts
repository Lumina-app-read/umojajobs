import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  citySlug,
  ERROR_CODES,
  type PlaceCityResponse,
  SITEMAP_MAX_OFFERS,
  type SitemapResponse,
  type JobSearchResponse,
  type PublicJobOfferDetail,
  type PublicJobOfferSummary,
  type SavedJobResponse,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { searchTerms } from './job-offer-rules';
import { dateOnly } from './job-offer.mapper';
import { type JobSearchQueryDto } from './job-offers.dto';

const DAY_MS = 86_400_000;
const DEFAULT_PAGE_SIZE = 20;
const ARCHIVE_PAGE_SIZE = 20;

/** Colonnes publiques uniquement : la requête ne lit jamais les champs privés. */
export const PUBLIC_SELECT = {
  id: true,
  slug: true,
  status: true,
  title: true,
  companyName: true,
  contractType: true,
  workMode: true,
  educationLevel: true,
  experienceLevel: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  salaryPeriod: true,
  endDate: true,
  endsAt: true,
  publishedAt: true,
  country: { select: { iso2: true } },
  city: { select: { id: true, name: true } },
  category: { select: { id: true, slug: true, nameFr: true, nameEn: true } },
} satisfies Prisma.JobOfferSelect;

export type PublicRow = Prisma.JobOfferGetPayload<{ select: typeof PUBLIC_SELECT }>;

/** Présentation publique. Une ligne incomplète (impossible après validation) est écartée. */
export function toPublicSummary(row: PublicRow): PublicJobOfferSummary | null {
  if (
    !row.slug ||
    !row.title ||
    !row.companyName ||
    !row.country ||
    !row.category ||
    !row.contractType ||
    !row.workMode ||
    !row.endDate ||
    !row.endsAt ||
    !row.publishedAt ||
    (row.status !== 'active' && row.status !== 'expired')
  ) {
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    title: row.title,
    companyName: row.companyName,
    countryIso2: row.country.iso2,
    city: row.city,
    category: row.category,
    contractType: row.contractType,
    workMode: row.workMode,
    educationLevel: row.educationLevel,
    experienceLevel: row.experienceLevel,
    salaryMin: row.salaryMin?.toString() ?? null,
    salaryMax: row.salaryMax?.toString() ?? null,
    salaryCurrency: row.salaryCurrency,
    salaryPeriod: row.salaryPeriod,
    endDate: dateOnly(row.endDate) as string,
    endsAt: row.endsAt.toISOString(),
    publishedAt: row.publishedAt.toISOString(),
    verified: true,
  };
}

const present = <T>(value: T | null): value is T => value !== null;

/**
 * Consultation publique (cahier des charges §8.1 et §15) : recherche parmi les offres actives,
 * archives des offres expirées, fiche détaillée, offres enregistrées. Les offres suspendues,
 * rejetées ou en cours de modération ne sont jamais visibles.
 */
@Injectable()
export class JobSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: JobSearchQueryDto, now: Date = new Date()): Promise<JobSearchResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.JobOfferWhereInput = {
      // Double garde : statut actif et fin de validité non atteinte (avant même l'expiration planifiée).
      status: 'active',
      endsAt: { gt: now },
      ...(query.country?.length ? { country: { iso2: { in: query.country } } } : {}),
      ...(query.cityId ? { cityId: query.cityId } : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.contractType ? { contractType: { in: query.contractType } } : {}),
      ...(query.workMode ? { workMode: { in: query.workMode } } : {}),
      ...(query.educationLevel ? { educationLevel: query.educationLevel } : {}),
      ...(query.experienceLevel ? { experienceLevel: query.experienceLevel } : {}),
      ...(query.publishedWithinDays
        ? { publishedAt: { gte: new Date(now.getTime() - query.publishedWithinDays * DAY_MS) } }
        : {}),
      AND: [
        ...(query.closingWithinDays
          ? [{ endsAt: { lte: new Date(now.getTime() + query.closingWithinDays * DAY_MS) } }]
          : []),
        // Chaque terme doit apparaître (index trigramme sur le texte normalisé).
        ...searchTerms(query.q).map((term) => ({ searchText: { contains: term } })),
      ],
    };
    const orderBy: Prisma.JobOfferOrderByWithRelationInput[] =
      query.sort === 'deadline'
        ? [{ endsAt: 'asc' }, { id: 'asc' }]
        : [{ publishedAt: 'desc' }, { id: 'desc' }];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.jobOffer.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: PUBLIC_SELECT,
      }),
      this.prisma.jobOffer.count({ where }),
    ]);
    return { items: rows.map(toPublicSummary).filter(present), total, page, pageSize };
  }

  /** Plan du site : offres actives et lieux ou catégories qui en ont au moins une. */
  async sitemap(now: Date = new Date()): Promise<SitemapResponse> {
    const active: Prisma.JobOfferWhereInput = { status: 'active', endsAt: { gt: now } };
    const [offers, countries, categories, cities] = await Promise.all([
      this.prisma.jobOffer.findMany({
        where: { ...active, slug: { not: null } },
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        take: SITEMAP_MAX_OFFERS,
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.jobOffer.groupBy({ by: ['countryId'], where: active, _count: true }),
      this.prisma.jobOffer.groupBy({ by: ['categoryId'], where: active, _count: true }),
      this.prisma.jobOffer.groupBy({
        by: ['cityId'],
        where: { ...active, cityId: { not: null } },
        _count: true,
      }),
    ]);
    const ids = <T extends { _count: number }>(rows: T[], key: keyof T) =>
      rows.flatMap((row) => (row[key] ? [row[key] as string] : []));
    const [countryRows, categoryRows, cityRows] = await Promise.all([
      this.prisma.country.findMany({
        where: { id: { in: ids(countries, 'countryId') }, isActive: true },
        select: { id: true, iso2: true },
      }),
      this.prisma.jobCategory.findMany({
        where: { id: { in: ids(categories, 'categoryId') }, isActive: true },
        select: { id: true, slug: true },
      }),
      this.prisma.city.findMany({
        where: { id: { in: ids(cities, 'cityId') }, isActive: true, country: { isActive: true } },
        select: { id: true, name: true, searchName: true, country: { select: { iso2: true } } },
      }),
    ]);
    const count = <T extends { _count: number }>(rows: T[], key: keyof T, id: string) =>
      rows.find((row) => row[key] === id)?._count ?? 0;
    return {
      offers: offers.map((row) => ({
        slug: row.slug as string,
        updatedAt: row.updatedAt.toISOString(),
      })),
      countries: countryRows
        .map((row) => ({ iso2: row.iso2, count: count(countries, 'countryId', row.id) }))
        .sort((a, b) => b.count - a.count || a.iso2.localeCompare(b.iso2)),
      categories: categoryRows
        .map((row) => ({ slug: row.slug, count: count(categories, 'categoryId', row.id) }))
        .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug)),
      cities: cityRows
        .map((row) => ({
          countryIso2: row.country.iso2,
          slug: citySlug(row.searchName),
          name: row.name,
          count: count(cities, 'cityId', row.id),
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    };
  }

  /**
   * Ville désignée par son adresse (/jobs/country/sn/dakar). Deux villes homonymes d'un même pays
   * se départagent par le nombre d'offres actives, puis par la population.
   */
  async placeCity(iso2: string, slug: string, now: Date = new Date()): Promise<PlaceCityResponse> {
    const candidates = await this.prisma.city.findMany({
      where: {
        searchName: slug.replace(/-/g, ' '),
        isActive: true,
        country: { iso2, isActive: true },
      },
      select: {
        id: true,
        name: true,
        searchName: true,
        population: true,
        _count: { select: { jobOffers: { where: { status: 'active', endsAt: { gt: now } } } } },
      },
      take: 20,
    });
    const best = candidates.sort(
      (a, b) => b._count.jobOffers - a._count.jobOffers || b.population - a.population,
    )[0];
    if (!best) throw new NotFoundException({ code: ERROR_CODES.CITY_NOT_FOUND });
    return { id: best.id, name: best.name, slug: citySlug(best.searchName), countryIso2: iso2 };
  }

  /** Archives : offres expirées, conservées et consultables, les plus récemment expirées d'abord. */
  async archives(page = 1): Promise<JobSearchResponse> {
    const where: Prisma.JobOfferWhereInput = { status: 'expired', slug: { not: null } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.jobOffer.findMany({
        where,
        orderBy: [{ expiredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * ARCHIVE_PAGE_SIZE,
        take: ARCHIVE_PAGE_SIZE,
        select: PUBLIC_SELECT,
      }),
      this.prisma.jobOffer.count({ where }),
    ]);
    return {
      items: rows.map(toPublicSummary).filter(present),
      total,
      page,
      pageSize: ARCHIVE_PAGE_SIZE,
    };
  }

  /** Fiche publique : active ou expirée (affichée comme telle). Tout autre statut : 404. */
  async detail(slug: string): Promise<PublicJobOfferDetail> {
    const row = await this.prisma.jobOffer.findFirst({
      where: { slug, status: { in: ['active', 'expired'] } },
      select: {
        ...PUBLIC_SELECT,
        description: true,
        requirements: true,
        skills: true,
        contentLanguage: true,
        startDate: true,
        sourceType: true,
        expiredAt: true,
        // Lues uniquement pour indiquer leur présence : jamais renvoyées.
        applicationEmail: true,
        applicationUrl: true,
        applicationAddress: true,
        applicationInstructions: true,
        applicationPhone: true,
        contributorTips: true,
        files: { where: { deletedAt: null }, select: { kind: true } },
      },
    });
    const summary = row ? toPublicSummary(row) : null;
    if (!row || !summary || !row.description || !row.startDate || !row.sourceType) {
      throw new NotFoundException({ code: ERROR_CODES.JOB_OFFER_NOT_FOUND });
    }
    return {
      ...summary,
      description: row.description,
      requirements: row.requirements,
      skills: row.skills,
      contentLanguage: row.contentLanguage,
      startDate: dateOnly(row.startDate) as string,
      sourceType: row.sourceType,
      expiredAt: row.expiredAt?.toISOString() ?? null,
      unlockContents: {
        applicationEmail: Boolean(row.applicationEmail),
        applicationUrl: Boolean(row.applicationUrl),
        applicationAddress: Boolean(row.applicationAddress),
        applicationInstructions: Boolean(row.applicationInstructions),
        applicationPhone: Boolean(row.applicationPhone),
        contributorTips: Boolean(row.contributorTips),
        originalDocument: row.files.some((file) => file.kind === 'original'),
        attachments: row.files.filter((file) => file.kind === 'attachment').length,
      },
    };
  }

  // --- Offres enregistrées -------------------------------------------------------------------

  async listSaved(auth: AuthContext): Promise<SavedJobResponse[]> {
    const saved = await this.prisma.savedJob.findMany({
      where: { userId: auth.user.id, jobOffer: { status: { in: ['active', 'expired'] } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { createdAt: true, jobOffer: { select: PUBLIC_SELECT } },
    });
    return saved
      .map((entry) => {
        const offer = toPublicSummary(entry.jobOffer);
        return offer ? { savedAt: entry.createdAt.toISOString(), offer } : null;
      })
      .filter(present);
  }

  /** Enregistrement idempotent. Seule une offre active peut être ajoutée. */
  async save(auth: AuthContext, jobOfferId: string): Promise<void> {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: jobOfferId, status: { in: ['active', 'expired'] } },
      select: { status: true },
    });
    if (!offer) throw new NotFoundException({ code: ERROR_CODES.JOB_OFFER_NOT_FOUND });
    if (offer.status !== 'active') {
      throw new ConflictException({ code: ERROR_CODES.JOB_OFFER_INVALID_TRANSITION });
    }
    await this.prisma.savedJob.upsert({
      where: { userId_jobOfferId: { userId: auth.user.id, jobOfferId } },
      create: { userId: auth.user.id, jobOfferId },
      update: {},
    });
  }

  async unsave(auth: AuthContext, jobOfferId: string): Promise<void> {
    await this.prisma.savedJob.deleteMany({ where: { userId: auth.user.id, jobOfferId } });
  }
}
