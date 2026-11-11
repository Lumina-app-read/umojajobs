import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  CREDIT_SERVICES,
  ERROR_CODES,
  FINANCIAL_SETTING_KEYS,
  type FinancialSettingResponse,
  type ServiceCostResponse,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { type ClientInfo } from '../common/http/app-request';
import { type CreditService, type FinancialSettingKey, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityEventsService } from '../security-events/security-events.service';
import { parseSettingValue } from './finance-rules';

type Db = PrismaService | Prisma.TransactionClient;

const author = { select: { id: true, firstName: true, lastName: true } } as const;
const authorName = (user: { id: string; firstName: string; lastName: string } | null) =>
  user ? { id: user.id, name: `${user.firstName} ${user.lastName}` } : null;

/**
 * Paramètres financiers et coûts des services, historisés en ajout seul.
 * La valeur en vigueur est la plus récente dont la date d'effet est passée.
 * Un paramètre jamais défini rend la fonction qui en dépend indisponible (aucune valeur par défaut).
 */
@Injectable()
export class FinancialSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityEvents: SecurityEventsService,
  ) {}

  /** Valeur en vigueur d'un paramètre ; erreur 503 explicite s'il n'est pas configuré. */
  async require(key: FinancialSettingKey, db: Db = this.prisma): Promise<Prisma.Decimal> {
    const row = await db.financialSetting.findFirst({
      where: { key, effectiveFrom: { lte: new Date() } },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      select: { value: true },
    });
    if (!row) throw new ServiceUnavailableException({ code: ERROR_CODES.FINANCE_NOT_CONFIGURED });
    return row.value;
  }

  /** Coût en vigueur d'un service, en crédits ; erreur 503 s'il n'est pas configuré. */
  async requireCost(service: CreditService, db: Db = this.prisma): Promise<number> {
    const row = await db.serviceCreditCost.findFirst({
      where: { service, effectiveFrom: { lte: new Date() } },
      orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      select: { credits: true },
    });
    if (!row) throw new ServiceUnavailableException({ code: ERROR_CODES.FINANCE_NOT_CONFIGURED });
    return row.credits;
  }

  async list(): Promise<FinancialSettingResponse[]> {
    const now = new Date();
    return Promise.all(
      FINANCIAL_SETTING_KEYS.map(async (key) => {
        const row = await this.prisma.financialSetting.findFirst({
          where: { key, effectiveFrom: { lte: now } },
          orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
          include: { changedBy: author },
        });
        return {
          key,
          value: row ? row.value.toString() : null,
          effectiveFrom: row?.effectiveFrom.toISOString() ?? null,
          reason: row?.reason ?? null,
          changedBy: authorName(row?.changedBy ?? null),
        };
      }),
    );
  }

  async listCosts(): Promise<ServiceCostResponse[]> {
    const now = new Date();
    return Promise.all(
      CREDIT_SERVICES.map(async (service) => {
        const row = await this.prisma.serviceCreditCost.findFirst({
          where: { service, effectiveFrom: { lte: now } },
          orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
          include: { changedBy: author },
        });
        return {
          service,
          credits: row?.credits ?? null,
          effectiveFrom: row?.effectiveFrom.toISOString() ?? null,
          reason: row?.reason ?? null,
          changedBy: authorName(row?.changedBy ?? null),
        };
      }),
    );
  }

  /** Nouvelle valeur, effective immédiatement ; l'ancienne reste dans l'historique. */
  async update(
    auth: AuthContext,
    key: FinancialSettingKey,
    rawValue: string,
    reason: string,
    client: ClientInfo,
  ): Promise<FinancialSettingResponse[]> {
    const value = parseSettingValue(key, rawValue);
    if (!value) throw new BadRequestException({ code: ERROR_CODES.FINANCIAL_SETTING_INVALID });

    await this.prisma.$transaction(async (tx) => {
      const previous = await tx.financialSetting.findFirst({
        where: { key, effectiveFrom: { lte: new Date() } },
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        select: { value: true },
      });
      await tx.financialSetting.create({
        data: { key, value, effectiveFrom: new Date(), changedById: auth.user.id, reason },
      });
      await this.securityEvents.record(
        {
          type: 'financial_setting_changed',
          userId: auth.user.id,
          client,
          metadata: {
            target: key,
            before: previous ? previous.value.toString() : null,
            after: value.toString(),
          },
        },
        tx,
      );
    });
    return this.list();
  }

  async updateCost(
    auth: AuthContext,
    service: CreditService,
    credits: number,
    reason: string,
    client: ClientInfo,
  ): Promise<ServiceCostResponse[]> {
    await this.prisma.$transaction(async (tx) => {
      const previous = await tx.serviceCreditCost.findFirst({
        where: { service, effectiveFrom: { lte: new Date() } },
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        select: { credits: true },
      });
      await tx.serviceCreditCost.create({
        data: { service, credits, effectiveFrom: new Date(), changedById: auth.user.id, reason },
      });
      await this.securityEvents.record(
        {
          type: 'financial_setting_changed',
          userId: auth.user.id,
          client,
          metadata: {
            target: `cost:${service}`,
            before: previous?.credits ?? null,
            after: credits,
          },
        },
        tx,
      );
    });
    return this.listCosts();
  }
}
