import { type AdminOverview, PERMISSIONS } from '@opportinities/shared';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CircleCheck,
  Clock,
  Coins,
  FilePen,
  HandCoins,
  KeyRound,
  Lock,
  type LucideIcon,
  MailWarning,
  Mails,
  RefreshCw,
  ShieldX,
  Sparkles,
  Unlock,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Wallet,
} from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState, StatCard } from '@/components/ui/feedback';
import { Link } from '@/i18n/navigation';
import { visibleAdminNav } from '@/features/app-shell/admin-nav';
import { DailyChart } from '@/features/admin/daily-chart';
import { getAdminOverview } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';
import { cn } from '@/lib/cn';

export async function generateMetadata(): Promise<Metadata> {
  // Sans la permission, rien ne doit révéler l'existence de l'administration.
  if (!(await hasPermission(PERMISSIONS.ADMIN_ACCESS))) return {};
  const t = await getTranslations('common.admin.overview');
  return { title: t('title') };
}

interface QueueItem {
  key: 'pendingReview' | 'needsCorrection' | 'withdrawals' | 'anomalies' | 'emails' | 'locked';
  count: number;
  hint: string;
  href: string | null;
  icon: LucideIcon;
  tone: 'warning' | 'danger' | 'neutral';
}

/** Évolution en pourcentage par rapport à la période précédente. */
function trendOf(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 'flat' : 'new';
  const change = Math.round(((current - previous) / previous) * 100);
  return change === 0 ? 'flat' : change;
}

/**
 * Tableau de bord de l'administration : file des actions en attente, indicateurs des 30 derniers
 * jours comparés aux 30 précédents, courbes journalières et état de la plateforme. Toutes les
 * valeurs viennent de l'API ; chaque bloc n'apparaît qu'avec la permission correspondante.
 */
export default async function AdminOverviewPage() {
  const user = await requirePermission(PERMISSIONS.ADMIN_ACCESS);
  const [t, format, data] = await Promise.all([
    getTranslations('common.admin'),
    getFormatter(),
    getAdminOverview(),
  ]);
  const can = (code: string) => user.permissions.includes(code);
  const money = (value: string | number) =>
    format.number(Number(value), { style: 'currency', currency: 'USD' });
  const number = (value: number) => format.number(value);
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00Z`), {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });

  const shortcuts = visibleAdminNav(user.permissions)
    .flatMap((group) => group.items)
    .filter((item) => item.key !== 'overview');

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          {t('overview.title')}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {t('overview.intro', { days: data?.days ?? 30 })}
        </p>
        {data && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-subtle">
            <Clock className="size-3.5" aria-hidden="true" />
            {t('overview.updated', {
              date: format.dateTime(new Date(data.generatedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </p>
        )}
      </div>
      <ButtonLink href="/admin" variant="secondary" icon={RefreshCw}>
        {t('overview.refresh')}
      </ButtonLink>
    </div>
  );

  if (!data) {
    return (
      <div className="grid gap-8">
        {header}
        <EmptyState
          icon={AlertTriangle}
          title={t('overview.unavailable')}
          className="bg-surface py-12"
        />
      </div>
    );
  }

  // Clés construites à partir de valeurs connues (QueueItem) : vérifiées par le test de traduction.
  const queue = buildQueue(data, can, (key, values) => t(key as never, values as never), money);
  const trend = (current: number, previous: number) => {
    const value = trendOf(current, previous);
    if (value === 'flat') return { value: t('overview.trendFlat'), positive: true };
    if (value === 'new') return { value: t('overview.trendNew'), positive: true };
    return {
      value:
        value > 0
          ? t('overview.trendUp', { value: number(value) })
          : t('overview.trendDown', { value: number(value) }),
      positive: value > 0,
    };
  };

  const kpis: Parameters<typeof StatCard>[0][] = [];
  if (data.finance) {
    kpis.push(
      {
        icon: Coins,
        label: t('overview.kpi.revenue'),
        value: money(data.finance.revenueUsd),
        trend: trend(Number(data.finance.revenueUsd), Number(data.finance.revenuePreviousUsd)),
        hint: t('overview.kpi.revenueHint', { count: data.finance.paidOrders }),
      },
      {
        icon: Unlock,
        label: t('overview.kpi.unlocks'),
        value: number(data.finance.unlocks),
        trend: trend(data.finance.unlocks, data.finance.unlocksPrevious),
        hint: t('overview.versus'),
      },
    );
  }
  if (data.users) {
    kpis.push({
      icon: UserPlus,
      label: t('overview.kpi.signups'),
      value: number(data.users.newInPeriod),
      trend: trend(data.users.newInPeriod, data.users.newPreviousPeriod),
      hint: t('overview.kpi.signupsHint', { total: number(data.users.total) }),
    });
  }
  if (data.jobs) {
    kpis.push({
      icon: BriefcaseBusiness,
      label: t('overview.kpi.published'),
      value: number(data.jobs.publishedInPeriod),
      trend: trend(data.jobs.publishedInPeriod, data.jobs.publishedPreviousPeriod),
      hint: t('overview.kpi.publishedHint', { active: number(data.jobs.active) }),
    });
  }

  const points = (pick: (point: AdminOverview['series'][number]) => number | string | null) =>
    data.series.flatMap((point) => {
      const value = pick(point);
      return value === null ? [] : [{ date: point.date, value: Number(value) }];
    });
  const sum = (list: { value: number }[]) => list.reduce((total, point) => total + point.value, 0);
  const charts: {
    key: string;
    title: string;
    points: { date: string; value: number }[];
    money?: boolean;
  }[] = [
    {
      key: 'revenue',
      title: t('overview.chart.revenue'),
      points: points((p) => p.revenueUsd),
      money: true,
    },
    { key: 'unlocks', title: t('overview.chart.unlocks'), points: points((p) => p.unlocks) },
    { key: 'signups', title: t('overview.chart.signups'), points: points((p) => p.signups) },
    { key: 'published', title: t('overview.chart.published'), points: points((p) => p.published) },
  ].filter((chart) => chart.points.length > 0);

  const health: { icon: LucideIcon; label: string; value: string; alert?: boolean }[] = [];
  if (data.users) {
    health.push(
      {
        icon: UserCheck,
        label: t('overview.health.usersActive'),
        value: number(data.users.active),
      },
      {
        icon: UserX,
        label: t('overview.health.usersSuspended'),
        value: number(data.users.suspended),
      },
      {
        icon: BadgeCheck,
        label: t('overview.health.usersVerified'),
        value:
          data.users.total > 0
            ? format.number(data.users.verified / data.users.total, { style: 'percent' })
            : number(0),
      },
    );
  }
  if (data.jobs) {
    health.push(
      {
        icon: BriefcaseBusiness,
        label: t('overview.health.offersActive'),
        value: number(data.jobs.active),
      },
      {
        icon: Clock,
        label: t('overview.health.expiringSoon'),
        value: number(data.jobs.expiringSoon),
      },
    );
  }
  if (data.finance) {
    health.push(
      {
        icon: HandCoins,
        label: t('overview.health.commissionsPending'),
        value: money(data.finance.commissionsPendingUsd),
      },
      {
        icon: Wallet,
        label: t('overview.health.commissionsAvailable'),
        value: money(data.finance.commissionsAvailableUsd),
      },
      {
        icon: Sparkles,
        label: t('overview.health.aiRequests'),
        value: number(data.finance.aiRequests),
      },
      { icon: Sparkles, label: t('overview.health.aiCost'), value: money(data.finance.aiCostUsd) },
    );
  }
  if (data.security) {
    health.push(
      {
        icon: ShieldX,
        label: t('overview.health.loginFailed'),
        value: number(data.security.loginFailed24h),
        alert: data.security.loginFailed24h > 0,
      },
      {
        icon: KeyRound,
        label: t('overview.health.mfaFailed'),
        value: number(data.security.mfaFailed24h),
        alert: data.security.mfaFailed24h > 0,
      },
    );
  }
  if (data.emails) {
    health.push({
      icon: Mails,
      label: t('overview.health.emailsPending'),
      value: number(data.emails.pending),
    });
  }

  const pending = queue.filter((item) => item.count > 0);

  return (
    <div className="grid gap-8">
      {header}

      {queue.length > 0 && (
        <section aria-labelledby="admin-queue" className="grid gap-3">
          <h2 id="admin-queue" className="text-base font-semibold text-fg">
            {t('overview.queueTitle')}
          </h2>
          {pending.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
                <CircleCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-fg">{t('overview.queueEmpty')}</p>
                <p className="text-sm text-fg-muted">{t('overview.queueEmptyBody')}</p>
              </div>
            </div>
          ) : (
            <ul className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pending.map((item) => (
                <li key={item.key}>
                  <QueueCard item={item} label={t(`overview.queue.${item.key}`)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {kpis.length > 0 ? (
        <div className="stagger grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <StatCard key={kpi.label} {...kpi} />
          ))}
        </div>
      ) : (
        queue.length === 0 && (
          <EmptyState icon={Users} title={t('overview.noData')} className="bg-surface py-12" />
        )
      )}

      {charts.length > 0 && (
        <section aria-labelledby="admin-charts" className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="admin-charts" className="text-base font-semibold text-fg">
              {t('overview.chartsTitle')}
            </h2>
            <p className="text-xs text-fg-subtle">{t('overview.chartsHint')}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {charts.map((chart) => {
              const display = chart.money ? money : number;
              const max = Math.max(0, ...chart.points.map((point) => point.value));
              return (
                <DailyChart
                  key={chart.key}
                  title={chart.title}
                  total={t('overview.chartTotal', { value: display(sum(chart.points)) })}
                  points={chart.points}
                  formatValue={display}
                  formatDay={day}
                  labels={{
                    max: t('overview.chartMax', { value: display(max) }),
                    empty: t('overview.chartEmpty'),
                    table: t('overview.chartTable'),
                    date: t('overview.chartDate'),
                    value: t('overview.chartValue'),
                  }}
                />
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {health.length > 0 && (
          <section aria-labelledby="admin-health">
            <h2 id="admin-health" className="mb-3 text-base font-semibold text-fg">
              {t('overview.healthTitle')}
            </h2>
            <dl className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
              {health.map(({ icon: Icon, label, value, alert }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3">
                  <Icon
                    className={cn('size-4 shrink-0', alert ? 'text-danger' : 'text-fg-subtle')}
                    aria-hidden="true"
                  />
                  <dt className="flex-1 text-sm text-fg-muted">{label}</dt>
                  <dd
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      alert ? 'text-danger' : 'text-fg',
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {shortcuts.length > 0 && (
          <section aria-labelledby="admin-shortcuts">
            <h2 id="admin-shortcuts" className="mb-3 text-base font-semibold text-fg">
              {t('overview.shortcutsTitle')}
            </h2>
            <ul className="grid gap-2 min-[420px]:grid-cols-2">
              {shortcuts.map(({ key, href, icon: Icon }) => (
                <li key={key}>
                  <Link
                    href={href}
                    className="lift flex items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-3 text-sm font-medium text-fg shadow-xs hover:border-line-strong"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft text-brand">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t(`nav.${key}`)}</span>
                    <ArrowRight className="size-4 text-fg-subtle" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

const TONE_CLASSES: Record<QueueItem['tone'], string> = {
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-2 text-fg-muted',
};

function QueueCard({ item, label }: { item: QueueItem; label: string }) {
  const Icon = item.icon;
  const body = (
    <>
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-lg',
          TONE_CLASSES[item.tone],
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{label}</span>
        <span className="block text-xs text-fg-subtle">{item.hint}</span>
      </span>
      <span className="text-xl font-bold tabular-nums text-fg">{item.count}</span>
      {item.href && <ArrowRight className="size-4 text-fg-subtle" aria-hidden="true" />}
    </>
  );
  const classes =
    'flex h-full items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs';
  return item.href ? (
    <Link href={item.href} className={cn(classes, 'lift hover:border-line-strong')}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

/** Actions en attente, dans l'ordre d'urgence. Un lien n'apparaît que si la rubrique est ouverte. */
function buildQueue(
  data: AdminOverview,
  can: (code: string) => boolean,
  t: (key: string, values?: Record<string, string | number>) => string,
  money: (value: string) => string,
): QueueItem[] {
  const items: QueueItem[] = [];
  const link = (permission: string, href: string) => (can(permission) ? href : null);
  if (data.jobs) {
    items.push(
      {
        key: 'pendingReview',
        count: data.jobs.pendingReview,
        hint: t('overview.queueHint.pendingReview'),
        href: link(PERMISSIONS.JOBS_MODERATE, '/admin/moderation?status=pending_review'),
        icon: FilePen,
        tone: 'warning',
      },
      {
        key: 'needsCorrection',
        count: data.jobs.needsCorrection,
        hint: t('overview.queueHint.needsCorrection'),
        href: link(PERMISSIONS.JOBS_MODERATE, '/admin/moderation?status=needs_correction'),
        icon: FilePen,
        tone: 'neutral',
      },
    );
  }
  if (data.finance) {
    items.push(
      {
        key: 'withdrawals',
        count: data.finance.withdrawalsOpen,
        hint: t('overview.queueHint.withdrawals', {
          amount: money(data.finance.withdrawalsOpenUsd),
        }),
        href: link(PERMISSIONS.FINANCE_MANAGE, '/admin/withdrawals'),
        icon: ArrowDownToLine,
        tone: 'warning',
      },
      {
        key: 'anomalies',
        count: data.finance.anomalies,
        hint: t('overview.queueHint.anomalies'),
        href: link(PERMISSIONS.FINANCE_READ, '/admin/payments?status=anomaly'),
        icon: AlertTriangle,
        tone: 'danger',
      },
    );
  }
  if (data.emails) {
    items.push({
      key: 'emails',
      count: data.emails.failed,
      hint: t('overview.queueHint.emails'),
      href: link(PERMISSIONS.SETTINGS_MANAGE, '/admin/notifications'),
      icon: MailWarning,
      tone: 'danger',
    });
  }
  if (data.security) {
    items.push({
      key: 'locked',
      count: data.security.accountsLocked7d,
      hint: t('overview.queueHint.locked'),
      href: link(PERMISSIONS.SECURITY_EVENTS_READ, '/admin/security-events?type=account_locked'),
      icon: Lock,
      tone: 'neutral',
    });
  }
  return items;
}
