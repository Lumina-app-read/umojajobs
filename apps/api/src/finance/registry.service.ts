import { Injectable } from '@nestjs/common';
import {
  COMMISSION_STATUSES,
  type CommissionRegistryResponse,
  type CommissionRegistrySummary,
  type CommissionStatus,
  type CreditOrderStatus,
  type PaymentRegistryResponse,
  REGISTRY_PAGE_SIZE,
  type RegistryPerson,
  type UnlockRegistryResponse,
} from '@opportinities/shared';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RegistryQuery {
  q?: string;
  page: number;
}

const PERSON = { id: true, firstName: true, lastName: true, email: true } as const;
const OFFER = { id: true, title: true, companyName: true } as const;

const person = (user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}): RegistryPerson => ({
  id: user.id,
  name: `${user.firstName} ${user.lastName}`.trim(),
  email: user.email,
});

/** Une offre déverrouillée a toujours un titre ; seul un brouillon peut en manquer. */
const offer = (row: { id: string; title: string | null; companyName: string | null }) => ({
  ...row,
  title: row.title ?? '',
});

const usd = (value: Prisma.Decimal | null | undefined, digits = 2): string =>
  (value ?? new Prisma.Decimal(0)).toFixed(digits);

const contains = (q: string) => ({ contains: q, mode: 'insensitive' as const });
const matchesPerson = (q: string): Prisma.UserWhereInput => ({
  OR: [{ email: contains(q) }, { firstName: contains(q) }, { lastName: contains(q) }],
});
const pagination = (page: number) => ({
  skip: (page - 1) * REGISTRY_PAGE_SIZE,
  take: REGISTRY_PAGE_SIZE,
});

/**
 * Registres financiers de l'administration (paiements, déverrouillages, commissions). Consultation
 * seule : aucune écriture ici, et les données brutes du prestataire ne sont jamais exposées.
 */
@Injectable()
export class RegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async payments(
    query: RegistryQuery,
    status: CreditOrderStatus | undefined,
  ): Promise<PaymentRegistryResponse> {
    const where: Prisma.CreditOrderWhereInput = {
      ...(status && { status }),
      ...(query.q && {
        OR: [
          { reference: contains(query.q) },
          { providerSaleId: contains(query.q) },
          { user: matchesPerson(query.q) },
        ],
      }),
    };
    const [total, rows, paid, anomalies, settled, awaiting] = await Promise.all([
      this.prisma.creditOrder.count({ where }),
      this.prisma.creditOrder.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pagination(query.page),
        select: {
          id: true,
          reference: true,
          credits: true,
          priceUsd: true,
          status: true,
          failureReason: true,
          providerSaleId: true,
          createdAt: true,
          paidAt: true,
          user: { select: PERSON },
          pack: { select: { name: true } },
          payment: {
            select: { amountUsd: true, settlementAmount: true, settlementDoneAt: true },
          },
        },
      }),
      this.prisma.payment.aggregate({ _count: true, _sum: { amountUsd: true } }),
      this.prisma.creditOrder.count({ where: { status: 'anomaly' } }),
      this.prisma.payment.aggregate({
        where: { settlementDoneAt: { not: null }, settlementAmount: { not: null } },
        _sum: { amountUsd: true, settlementAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: { settlementDoneAt: null },
        _sum: { amountUsd: true },
      }),
    ]);
    const settledGross = settled._sum.amountUsd ?? new Prisma.Decimal(0);
    const settledNet = settled._sum.settlementAmount ?? new Prisma.Decimal(0);
    return {
      total,
      page: query.page,
      pageSize: REGISTRY_PAGE_SIZE,
      summary: {
        paidOrders: paid._count,
        grossUsd: usd(paid._sum.amountUsd),
        settledNetUsd: usd(settledNet),
        settledFeesUsd: usd(settledGross.sub(settledNet)),
        awaitingUsd: usd(awaiting._sum.amountUsd),
        anomalies,
      },
      items: rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        buyer: person(row.user),
        packName: row.pack.name,
        credits: row.credits,
        priceUsd: usd(row.priceUsd),
        status: row.status,
        failureReason: row.failureReason,
        providerSaleId: row.providerSaleId,
        createdAt: row.createdAt.toISOString(),
        paidAt: row.paidAt?.toISOString() ?? null,
        settlement: row.payment?.settlementAmount
          ? {
              netUsd: usd(row.payment.settlementAmount),
              feesUsd: usd(row.payment.amountUsd.sub(row.payment.settlementAmount)),
              doneAt: row.payment.settlementDoneAt?.toISOString() ?? null,
            }
          : null,
      })),
    };
  }

  async unlocks(query: RegistryQuery): Promise<UnlockRegistryResponse> {
    const where: Prisma.JobUnlockWhereInput = query.q
      ? {
          OR: [
            { user: matchesPerson(query.q) },
            { jobOffer: { title: contains(query.q) } },
            { jobOffer: { companyName: contains(query.q) } },
          ],
        }
      : {};
    const [total, rows, all, withCommission] = await Promise.all([
      this.prisma.jobUnlock.count({ where }),
      this.prisma.jobUnlock.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pagination(query.page),
        select: {
          id: true,
          credits: true,
          valueUsd: true,
          createdAt: true,
          user: { select: PERSON },
          jobOffer: { select: OFFER },
          commission: { select: { amountUsd: true, status: true } },
        },
      }),
      this.prisma.jobUnlock.aggregate({ _count: true, _sum: { credits: true, valueUsd: true } }),
      this.prisma.jobUnlock.count({ where: { commission: { isNot: null } } }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: REGISTRY_PAGE_SIZE,
      summary: {
        unlocks: all._count,
        credits: all._sum.credits ?? 0,
        valueUsd: usd(all._sum.valueUsd),
        withCommission,
      },
      items: rows.map((row) => ({
        id: row.id,
        candidate: person(row.user),
        offer: offer(row.jobOffer),
        credits: row.credits,
        valueUsd: usd(row.valueUsd),
        commission: row.commission
          ? { amountUsd: usd(row.commission.amountUsd), status: row.commission.status }
          : null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async commissions(
    query: RegistryQuery,
    status: CommissionStatus | undefined,
  ): Promise<CommissionRegistryResponse> {
    const where: Prisma.CommissionWhereInput = {
      ...(status && { status }),
      ...(query.q && {
        OR: [
          { contributor: matchesPerson(query.q) },
          { jobOffer: { title: contains(query.q) } },
          { jobOffer: { companyName: contains(query.q) } },
        ],
      }),
    };
    const [total, rows, groups] = await Promise.all([
      this.prisma.commission.count({ where }),
      this.prisma.commission.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pagination(query.page),
        select: {
          id: true,
          baseValueUsd: true,
          rate: true,
          amountUsd: true,
          status: true,
          createdAt: true,
          availableAt: true,
          reversedAt: true,
          contributor: { select: PERSON },
          jobOffer: { select: OFFER },
        },
      }),
      this.prisma.commission.groupBy({
        by: ['status'],
        _count: true,
        _sum: { amountUsd: true },
      }),
    ]);
    const summary = Object.fromEntries(
      COMMISSION_STATUSES.map((value) => {
        const group = groups.find((entry) => entry.status === value);
        return [value, { count: group?._count ?? 0, amountUsd: usd(group?._sum.amountUsd) }];
      }),
    ) as CommissionRegistrySummary;
    return {
      total,
      page: query.page,
      pageSize: REGISTRY_PAGE_SIZE,
      summary,
      items: rows.map((row) => ({
        id: row.id,
        contributor: person(row.contributor),
        offer: offer(row.jobOffer),
        baseValueUsd: usd(row.baseValueUsd),
        rate: row.rate.toString(),
        amountUsd: usd(row.amountUsd),
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        availableAt: row.availableAt?.toISOString() ?? null,
        reversedAt: row.reversedAt?.toISOString() ?? null,
      })),
    };
  }
}
