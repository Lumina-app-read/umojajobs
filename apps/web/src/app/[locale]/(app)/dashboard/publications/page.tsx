import { EDITABLE_JOB_STATUSES, type JobOfferStatus } from '@opportinities/shared';
import { Megaphone, Pencil, SquarePlus } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { getMyJobOffers } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.publications');
  return { title: t('title') };
}

const STATUS_TONE: Record<JobOfferStatus, BadgeTone> = {
  draft: 'neutral',
  pending_review: 'primary',
  needs_correction: 'warning',
  scheduled: 'primary',
  active: 'success',
  expired: 'neutral',
  rejected: 'danger',
  suspended: 'danger',
  archived: 'neutral',
};

/** Mes publications : état de vérification de chaque offre partagée, accès aux brouillons. */
export default async function PublicationsPage() {
  await requireUser();
  const t = await getTranslations('jobs');
  const format = await getFormatter();
  const offers = await getMyJobOffers();
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { dateStyle: 'medium' });

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            {t('publications.title')}
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">{t('publications.intro')}</p>
        </div>
        <ButtonLink href="/dashboard/publish" size="lg" icon={SquarePlus}>
          {t('publications.publish')}
        </ButtonLink>
      </div>

      {offers === null ? (
        <Alert tone="error">{t('publications.unavailable')}</Alert>
      ) : offers.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={t('publications.empty')}
          description={t('publications.emptyBody')}
          className="bg-surface py-14"
          action={
            <ButtonLink href="/dashboard/publish" icon={SquarePlus}>
              {t('publications.publish')}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="stagger grid gap-3">
          {offers.map((offer) => {
            const editable = EDITABLE_JOB_STATUSES.includes(offer.status);
            const details = [
              offer.companyName,
              offer.endDate ? t('publications.deadline', { date: day(offer.endDate) }) : null,
              t('publications.updated', {
                date: format.dateTime(new Date(offer.updatedAt), { dateStyle: 'medium' }),
              }),
            ].filter(Boolean);
            return (
              <li
                key={offer.id}
                className="lift flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[15px] font-semibold text-fg">
                      {offer.title ?? t('publications.untitled')}
                    </p>
                    <Badge tone={STATUS_TONE[offer.status]} dot>
                      {t(`enums.status.${offer.status}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-fg-muted">{details.join(' · ')}</p>
                </div>
                {editable && (
                  <ButtonLink
                    href={`/dashboard/publish/${offer.id}`}
                    variant="secondary"
                    icon={Pencil}
                  >
                    {t('publications.edit')}
                  </ButtonLink>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
