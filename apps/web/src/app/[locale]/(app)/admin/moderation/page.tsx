import { countryName, type JobOfferStatus, PERMISSIONS } from '@opportinities/shared';
import { ArrowRight, Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { Link } from '@/i18n/navigation';
import { getModerationQueue } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';
import { cn } from '@/lib/cn';

/** Statuts consultables dans la file, dans l'ordre de traitement. */
const QUEUE_STATUSES = [
  'pending_review',
  'needs_correction',
  'scheduled',
  'active',
  'suspended',
  'rejected',
  'expired',
] as const satisfies readonly JobOfferStatus[];
type QueueStatus = (typeof QUEUE_STATUSES)[number];

const isQueueStatus = (value: unknown): value is QueueStatus =>
  typeof value === 'string' && (QUEUE_STATUSES as readonly string[]).includes(value);

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.JOBS_MODERATE))) return {};
  const t = await getTranslations('jobs.moderation');
  return { title: t('title') };
}

/** File de modération : les plus anciennes soumissions d'abord, filtrable par statut. */
export default async function ModerationQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.JOBS_MODERATE);
  const t = await getTranslations('jobs');
  const format = await getFormatter();
  const locale = await getLocale();
  const query = await searchParams;
  const status: QueueStatus = isQueueStatus(query.status) ? query.status : 'pending_review';
  const offers = await getModerationQueue(status);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          {t('moderation.title')}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">{t('moderation.intro')}</p>
      </div>

      <nav aria-label={t('moderation.filter')} className="-mx-1 overflow-x-auto px-1">
        <ul className="flex gap-1.5">
          {QUEUE_STATUSES.map((value) => (
            <li key={value}>
              <Link
                href={{ pathname: '/admin/moderation', query: { status: value } }}
                aria-current={value === status ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                  value === status
                    ? 'border-primary bg-primary-soft text-brand'
                    : 'border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg',
                )}
              >
                {t(`enums.status.${value}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {offers === null ? (
        <Alert tone="error">{t('moderation.unavailable')}</Alert>
      ) : offers.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t('moderation.empty')}
          description={t('moderation.emptyBody')}
          className="bg-surface py-14"
        />
      ) : (
        <ul className="stagger grid gap-3">
          {offers.map((offer) => (
            <li
              key={offer.id}
              className="lift flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-fg">
                  {offer.title ?? t('publications.untitled')}
                </p>
                <p className="mt-1 text-[13px] text-fg-muted">
                  {[
                    offer.companyName,
                    offer.countryIso2 && countryName(offer.countryIso2, locale),
                    offer.submittedAt
                      ? t('moderation.submitted', {
                          date: format.dateTime(new Date(offer.submittedAt), {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }),
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <ButtonLink
                href={`/admin/moderation/${offer.id}`}
                variant="secondary"
                trailingIcon={ArrowRight}
              >
                {t('moderation.open')}
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
