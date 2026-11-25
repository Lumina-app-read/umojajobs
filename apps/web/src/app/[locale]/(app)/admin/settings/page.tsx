import { PERMISSIONS, type PlatformService, type ServiceState } from '@opportinities/shared';
import {
  ArrowRight,
  BadgePercent,
  CircleAlert,
  CircleCheck,
  Clock,
  Cpu,
  Database,
  FileText,
  HardDrive,
  type LucideIcon,
  Mail,
  RefreshCw,
  Server,
  Settings,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { Link } from '@/i18n/navigation';
import { getPlatformStatus } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';
import { cn } from '@/lib/cn';

const SERVICE_ICON: Record<PlatformService['key'], LucideIcon> = {
  database: Database,
  redis: Zap,
  storage: HardDrive,
  mail: Mail,
  payments: Wallet,
  ai: Sparkles,
  pdf: FileText,
};
const STATE_TONE: Record<ServiceState, BadgeTone> = {
  up: 'success',
  down: 'danger',
  configured: 'primary',
  not_configured: 'warning',
};

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.SETTINGS_MANAGE))) return {};
  const t = await getTranslations('common.admin.platform');
  return { title: t('title') };
}

/**
 * Paramètres : état de la plateforme (services, prestataires, tâches planifiées, migrations).
 * Lecture seule, sans aucun secret ; les réglages financiers ont leur propre rubrique.
 */
export default async function PlatformSettingsPage() {
  const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const [t, format, status] = await Promise.all([
    getTranslations('common.admin.platform'),
    getFormatter(),
    getPlatformStatus(),
  ]);
  const when = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: 'short', timeStyle: 'medium' });
  const interval = (ms: number) =>
    ms < 60_000
      ? t('seconds', { count: Math.round(ms / 1000) })
      : t('minutes', { count: Math.round(ms / 60_000) });
  const duration = (seconds: number) => {
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const unit = (value: number, name: 'day' | 'hour' | 'minute') =>
      format.number(value, { style: 'unit', unit: name, unitDisplay: 'short' });
    return [
      days && unit(days, 'day'),
      (days || hours) && unit(hours, 'hour'),
      unit(minutes, 'minute'),
    ]
      .filter(Boolean)
      .join(' ');
  };

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          <Settings className="size-6 text-brand" aria-hidden="true" />
          {t('title')}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{t('intro')}</p>
        {status && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-subtle">
            <Clock className="size-3.5" aria-hidden="true" />
            {t('updated', { date: when(status.generatedAt) })}
          </p>
        )}
      </div>
      <ButtonLink href="/admin/settings" variant="secondary" icon={RefreshCw}>
        {t('refresh')}
      </ButtonLink>
    </div>
  );

  if (!status) {
    return (
      <div className="grid gap-6">
        {header}
        <Alert tone="error">{t('unavailable')}</Alert>
      </div>
    );
  }

  const down = status.services.filter((service) => service.state === 'down').length;
  const canFinance = user.permissions.includes(PERMISSIONS.FINANCE_READ);

  return (
    <div className="grid gap-6">
      {header}

      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border p-4 shadow-xs',
          down === 0 ? 'border-line bg-surface' : 'border-danger bg-danger-soft',
        )}
        role="status"
      >
        {down === 0 ? (
          <CircleCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <CircleAlert className="size-5 shrink-0 text-danger" aria-hidden="true" />
        )}
        <p className="text-sm font-semibold text-fg">
          {down === 0 ? t('summaryOk') : t('summaryDown', { count: down })}
        </p>
      </div>

      <section aria-labelledby="platform-services" className="grid gap-3">
        <h2 id="platform-services" className="text-base font-semibold text-fg">
          {t('servicesTitle')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {status.services.map((service) => {
            const Icon = SERVICE_ICON[service.key];
            const hint =
              service.state === 'configured' || service.state === 'not_configured'
                ? t(`stateHint.${service.state}`)
                : null;
            return (
              <li
                key={service.key}
                className="flex gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-fg">{t(`service.${service.key}`)}</p>
                    <Badge tone={STATE_TONE[service.state]} dot>
                      {t(`state.${service.state}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-fg-subtle">
                    {[
                      service.detail,
                      service.latencyMs !== null && t('latency', { ms: service.latencyMs }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="platform-tasks" className="grid content-start gap-3">
          <h2 id="platform-tasks" className="text-base font-semibold text-fg">
            {t('tasksTitle')}
          </h2>
          {!status.scheduledTasksEnabled && <Alert tone="warning">{t('tasksDisabled')}</Alert>}
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
            {status.tasks.map((task) => (
              <li
                key={task.key}
                className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{t(`task.${task.key}`)}</p>
                  <p className="text-xs text-fg-subtle">
                    {task.everyMs
                      ? t('every', { value: interval(task.everyMs) })
                      : t('notScheduled')}
                    {' · '}
                    {t('runs', { completed: task.completed, failed: task.failed })}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 text-xs tabular-nums sm:text-right">
                  <dt className="text-fg-subtle">{t('lastRun')}</dt>
                  <dd className="text-fg">{task.lastRunAt ? when(task.lastRunAt) : t('never')}</dd>
                  <dt className="text-fg-subtle">{t('nextRun')}</dt>
                  <dd className="text-fg">{task.nextRunAt ? when(task.nextRunAt) : '–'}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid min-w-0 grid-cols-1 content-start gap-6">
          <section aria-labelledby="platform-instance">
            <h2 id="platform-instance" className="mb-3 text-base font-semibold text-fg">
              {t('systemTitle')}
            </h2>
            <dl className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
              {(
                [
                  [Server, t('environment'), status.environment],
                  [Cpu, t('node'), status.nodeVersion],
                  [Clock, t('uptime'), duration(status.uptimeSeconds)],
                  [Database, t('migrations'), format.number(status.migrations.count)],
                  [Database, t('latestMigration'), status.migrations.latest ?? '–'],
                ] as const
              ).map(([Icon, label, value]) => (
                <div key={label} className="flex items-center gap-3 px-4 py-2.5">
                  <Icon className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                  <dt className="flex-1 text-sm text-fg-muted">{label}</dt>
                  <dd className="max-w-[55%] truncate text-right font-mono text-xs text-fg">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {canFinance && (
            <Link
              href="/admin/finance"
              className="lift flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs hover:border-line-strong"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
                <BadgePercent className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-fg">{t('financeLink')}</span>
                <span className="block text-xs text-fg-muted">{t('financeLinkBody')}</span>
              </span>
              <ArrowRight className="size-4 text-fg-subtle" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
