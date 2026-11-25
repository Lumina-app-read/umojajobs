import {
  NOTIFICATION_EMAIL_STATUSES,
  type NotificationEmailStatus,
  PERMISSIONS,
} from '@opportinities/shared';
import { ArrowRight, Bell, Clock, MailCheck, MailWarning, MailX, RotateCcw } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState, StatCard } from '@/components/ui/feedback';
import { EmailRetryButton } from '@/features/admin/email-retry-button';
import { firstParam, type SearchParams } from '@/features/jobs/routes';
import { Link } from '@/i18n/navigation';
import { getAdminEmails } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';
import { cn } from '@/lib/cn';

const BASE = '/admin/notifications';
const UUID = /^[0-9a-f-]{36}$/i;
const STAT_ICON = { pending: Clock, failed: MailWarning, skipped: MailX } as const;
const TONE: Record<NotificationEmailStatus, BadgeTone> = {
  pending: 'primary',
  sending: 'primary',
  sent: 'success',
  failed: 'danger',
  skipped: 'neutral',
};

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.SETTINGS_MANAGE))) return {};
  const t = await getTranslations('common.admin.emails');
  return { title: t('title') };
}

/**
 * Supervision des emails de notification : volumes par état et par type, liste filtrable et
 * relance des envois abandonnés. Le contenu des messages n'est jamais affiché.
 */
export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const params = await searchParams;
  const raw = firstParam(params.status);
  const status = NOTIFICATION_EMAIL_STATUSES.find((value) => value === raw);
  const before = firstParam(params.before);
  const [t, tTypes, tErrors, format, page] = await Promise.all([
    getTranslations('common.admin.emails'),
    getTranslations('notifications.types'),
    getTranslations('errors'),
    getFormatter(),
    getAdminEmails({ status, before: before && UUID.test(before) ? before : undefined }),
  ]);
  const href = (extra: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ status, ...extra })) {
      if (value) query.set(key, value);
    }
    const text = query.toString();
    return text ? `${BASE}?${text}` : BASE;
  };
  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            <Bell className="size-6 text-brand" aria-hidden="true" />
            {t('title')}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{t('intro')}</p>
        </div>
        {page && page.totals.failed > 0 && <EmailRetryButton count={page.totals.failed} />}
      </div>

      {page === null ? (
        <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>
      ) : (
        <>
          <div className="stagger grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={MailCheck}
              label={t('sent7d')}
              value={format.number(page.sentLast7d)}
              hint={`${t('status.sent')} : ${format.number(page.totals.sent)}`}
            />
            {(['pending', 'failed', 'skipped'] as const).map((key) => (
              <StatCard
                key={key}
                icon={STAT_ICON[key]}
                label={t(`status.${key}`)}
                value={format.number(
                  key === 'pending' ? page.totals.pending + page.totals.sending : page.totals[key],
                )}
                hint={t(`statusHint.${key}`)}
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section aria-labelledby="emails-list" className="grid content-start gap-3">
              <h2 id="emails-list" className="sr-only">
                {t('title')}
              </h2>
              <nav className="flex flex-wrap gap-2" aria-label={t('statusLabel')}>
                {[undefined, ...NOTIFICATION_EMAIL_STATUSES].map((value) => (
                  <Link
                    key={value ?? 'all'}
                    href={href({ status: value, before: undefined })}
                    aria-current={value === status ? 'page' : undefined}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors sm:text-[13px]',
                      value === status
                        ? 'border-primary bg-primary-soft text-brand'
                        : 'border-line text-fg-muted hover:bg-surface-2',
                    )}
                  >
                    {value ? t(`status.${value}`) : t('all')}
                  </Link>
                ))}
              </nav>

              {page.items.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title={t('empty')}
                  description={t('emptyBody')}
                  className="bg-surface py-14"
                />
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
                  {page.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg">
                          {tTypes(`${item.type}.title`)}
                        </p>
                        <p className="truncate text-xs text-fg-subtle">
                          {item.recipient.name} · {item.recipient.email}
                        </p>
                      </div>
                      <div className="text-xs text-fg-muted tabular-nums sm:text-right">
                        <p>
                          {t('created')} {date(item.createdAt)}
                        </p>
                        {item.sentAt && (
                          <p>
                            {t('sentAt')} {date(item.sentAt)}
                          </p>
                        )}
                        {item.nextAttemptAt && (
                          <p>
                            {t('nextAt')} {date(item.nextAttemptAt)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={TONE[item.status]}>{t(`status.${item.status}`)}</Badge>
                        <span className="text-xs text-fg-subtle tabular-nums">
                          {t('attempts')} {item.attempts}
                        </span>
                        {item.status === 'failed' && <EmailRetryButton id={item.id} />}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2">
                {before && (
                  <ButtonLink href={href({ before: undefined })} variant="ghost" icon={RotateCcw}>
                    {t('newest')}
                  </ButtonLink>
                )}
                {page.nextBefore && (
                  <ButtonLink
                    href={href({ before: page.nextBefore })}
                    variant="secondary"
                    trailingIcon={ArrowRight}
                  >
                    {t('older')}
                  </ButtonLink>
                )}
              </div>
            </section>

            <section aria-labelledby="emails-by-type" className="grid content-start gap-3">
              <h2 id="emails-by-type" className="text-sm font-semibold text-fg">
                {t('byType')}
              </h2>
              {page.byType.length === 0 ? (
                <p className="text-sm text-fg-muted">{t('byTypeEmpty')}</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
                  {page.byType.map((row) => (
                    <li key={row.type} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 text-fg-muted">
                        {tTypes(`${row.type}.title`)}
                      </span>
                      <span className="font-semibold text-fg tabular-nums">
                        {format.number(row.count)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
