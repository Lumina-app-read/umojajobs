import { Injectable } from '@nestjs/common';
import {
  ADMIN_OVERVIEW_DAYS,
  type AdminOverview,
  type AdminOverviewEmails,
  type AdminOverviewFinance,
  type AdminOverviewJobs,
  type AdminOverviewPoint,
  type AdminOverviewSecurity,
  type AdminOverviewUsers,
  PERMISSIONS,
} from '@opportinities/shared';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const usd = (value: Prisma.Decimal | null | undefined): string =>
  (value ?? new Prisma.Decimal(0)).toFixed(2);

interface Window {
  now: Date;
  /** Début de la fenêtre courante (minuit UTC, il y a `days - 1` jours). */
  start: Date;
  /** Début de la fenêtre précédente, de même durée. */
  previous: Date;
}

/** Fenêtre alignée sur des jours UTC entiers : les courbes et les totaux portent sur les mêmes jours. */
export function overviewWindow(now: Date, days = ADMIN_OVERVIEW_DAYS): Window {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = new Date(today - (days - 1) * DAY_MS);
  return { now, start, previous: new Date(start.getTime() - days * DAY_MS) };
}

/** Jours de la fenêtre, au format AAAA-MM-JJ. */
export function overviewDays(start: Date, days = ADMIN_OVERVIEW_DAYS): string[] {
  return Array.from({ length: days }, (_, index) =>
    new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10),
  );
}

type DailyRow = { day: string; value: Prisma.Decimal | bigint | number };

/**
 * Tableau de bord de l'administration : indicateurs réels, calculés à la demande. Chaque bloc
 * dépend d'une permission ; sans elle, il n'est ni calculé ni renvoyé. Lecture seule.
 */
@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(permissions: ReadonlySet<string>, now = new Date()): Promise<AdminOverview> {
    const window = overviewWindow(now);
    const can = (code: string) => permissions.has(code);
    const canUsers = can(PERMISSIONS.USERS_READ);
    const canJobs = can(PERMISSIONS.JOBS_MODERATE);
    const canFinance = can(PERMISSIONS.FINANCE_READ);

    const [users, jobs, finance, security, emails, signups, published, unlocks, revenue] =
      await Promise.all([
        canUsers ? this.users(window) : null,
        canJobs ? this.jobs(window) : null,
        canFinance ? this.finance(window) : null,
        can(PERMISSIONS.SECURITY_EVENTS_READ) ? this.security(window) : null,
        can(PERMISSIONS.SETTINGS_MANAGE) ? this.emails() : null,
        canUsers ? this.daily(Prisma.sql`users`, Prisma.sql`created_at`, window) : null,
        canJobs ? this.daily(Prisma.sql`job_offers`, Prisma.sql`published_at`, window) : null,
        canFinance ? this.daily(Prisma.sql`job_unlocks`, Prisma.sql`created_at`, window) : null,
        canFinance ? this.dailyRevenue(window) : null,
      ]);

    const series: AdminOverviewPoint[] = overviewDays(window.start).map((date) => ({
      date,
      signups: signups ? (signups.get(date) ?? 0) : null,
      published: published ? (published.get(date) ?? 0) : null,
      unlocks: unlocks ? (unlocks.get(date) ?? 0) : null,
      revenueUsd: revenue ? (revenue.get(date) ?? '0.00') : null,
    }));

    return {
      generatedAt: now.toISOString(),
      days: ADMIN_OVERVIEW_DAYS,
      users,
      jobs,
      finance,
      security,
      emails,
      series,
    };
  }

  private async users({ start, previous }: Window): Promise<AdminOverviewUsers> {
    const [total, suspended, verified, newInPeriod, newPreviousPeriod] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'suspended' } }),
      this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      this.prisma.user.count({ where: { createdAt: { gte: start } } }),
      this.prisma.user.count({ where: { createdAt: { gte: previous, lt: start } } }),
    ]);
    return {
      total,
      active: total - suspended,
      suspended,
      verified,
      newInPeriod,
      newPreviousPeriod,
    };
  }

  private async jobs({ now, start, previous }: Window): Promise<AdminOverviewJobs> {
    const soon = new Date(now.getTime() + 7 * DAY_MS);
    const [statuses, expiringSoon, publishedInPeriod, publishedPreviousPeriod] = await Promise.all([
      this.prisma.jobOffer.groupBy({
        by: ['status'],
        where: { status: { in: ['pending_review', 'needs_correction', 'active'] } },
        _count: true,
      }),
      this.prisma.jobOffer.count({
        where: { status: 'active', endsAt: { gt: now, lte: soon } },
      }),
      this.prisma.jobOffer.count({ where: { publishedAt: { gte: start } } }),
      this.prisma.jobOffer.count({ where: { publishedAt: { gte: previous, lt: start } } }),
    ]);
    const count = (status: string) => statuses.find((row) => row.status === status)?._count ?? 0;
    return {
      pendingReview: count('pending_review'),
      needsCorrection: count('needs_correction'),
      active: count('active'),
      expiringSoon,
      publishedInPeriod,
      publishedPreviousPeriod,
    };
  }

  private async finance({ start, previous }: Window): Promise<AdminOverviewFinance> {
    const OPEN = ['pending', 'under_review', 'approved', 'processing'] as const;
    const [
      revenue,
      revenuePrevious,
      anomalies,
      unlocks,
      unlocksPrevious,
      commissions,
      withdrawals,
      ai,
    ] = await Promise.all([
      this.prisma.creditOrder.aggregate({
        where: { status: 'paid', paidAt: { gte: start } },
        _sum: { priceUsd: true },
        _count: true,
      }),
      this.prisma.creditOrder.aggregate({
        where: { status: 'paid', paidAt: { gte: previous, lt: start } },
        _sum: { priceUsd: true },
      }),
      this.prisma.creditOrder.count({ where: { status: 'anomaly' } }),
      this.prisma.jobUnlock.count({ where: { createdAt: { gte: start } } }),
      this.prisma.jobUnlock.count({ where: { createdAt: { gte: previous, lt: start } } }),
      this.prisma.commission.groupBy({
        by: ['status'],
        where: { status: { in: ['pending', 'available'] } },
        _sum: { amountUsd: true },
      }),
      this.prisma.withdrawalRequest.aggregate({
        where: { status: { in: [...OPEN] } },
        _sum: { amountUsd: true },
        _count: true,
      }),
      this.prisma.aiRequest.aggregate({
        where: { createdAt: { gte: start } },
        _sum: { estimatedCostUsd: true },
        _count: true,
      }),
    ]);
    const commission = (status: string) =>
      usd(commissions.find((row) => row.status === status)?._sum.amountUsd);
    return {
      revenueUsd: usd(revenue._sum.priceUsd),
      revenuePreviousUsd: usd(revenuePrevious._sum.priceUsd),
      paidOrders: revenue._count,
      anomalies,
      unlocks,
      unlocksPrevious,
      commissionsPendingUsd: commission('pending'),
      commissionsAvailableUsd: commission('available'),
      withdrawalsOpen: withdrawals._count,
      withdrawalsOpenUsd: usd(withdrawals._sum.amountUsd),
      aiRequests: ai._count,
      aiCostUsd: usd(ai._sum.estimatedCostUsd),
    };
  }

  private async security({ now }: Window): Promise<AdminOverviewSecurity> {
    const dayAgo = new Date(now.getTime() - DAY_MS);
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const [loginFailed24h, accountsLocked7d, mfaFailed24h] = await Promise.all([
      this.prisma.securityEvent.count({
        where: { type: 'login_failed', createdAt: { gte: dayAgo } },
      }),
      this.prisma.securityEvent.count({
        where: { type: 'account_locked', createdAt: { gte: weekAgo } },
      }),
      this.prisma.securityEvent.count({
        where: { type: 'mfa_failed', createdAt: { gte: dayAgo } },
      }),
    ]);
    return { loginFailed24h, accountsLocked7d, mfaFailed24h };
  }

  private async emails(): Promise<AdminOverviewEmails> {
    const [failed, pending] = await Promise.all([
      this.prisma.notification.count({ where: { emailStatus: 'failed' } }),
      this.prisma.notification.count({ where: { emailStatus: { in: ['pending', 'sending'] } } }),
    ]);
    return { failed, pending };
  }

  /** Nombre de lignes par jour UTC sur la fenêtre (table et colonne fixées par le code). */
  private async daily(
    table: Prisma.Sql,
    column: Prisma.Sql,
    { start }: Window,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<DailyRow[]>`
      SELECT to_char(date_trunc('day', ${column} AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
             count(*)::int AS value
        FROM ${table}
       WHERE ${column} >= ${start}
       GROUP BY 1`;
    return new Map(rows.map((row) => [row.day, Number(row.value)]));
  }

  /** Ventes payées par jour UTC (date du paiement). */
  private async dailyRevenue({ start }: Window): Promise<Map<string, string>> {
    const rows = await this.prisma.$queryRaw<DailyRow[]>`
      SELECT to_char(date_trunc('day', paid_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
             sum(price_usd) AS value
        FROM credit_orders
       WHERE status = 'paid' AND paid_at >= ${start}
       GROUP BY 1`;
    return new Map(rows.map((row) => [row.day, new Prisma.Decimal(String(row.value)).toFixed(2)]));
  }
}
