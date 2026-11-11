import { Briefcase, Unlock } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { JobCard } from '@/features/jobs/job-card';
import { getUnlocks } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.app.nav');
  return { title: t('unlocked') };
}

/** Offres déverrouillées : l'accès aux coordonnées reste acquis après l'expiration. */
export default async function UnlockedJobsPage() {
  await requireUser();
  const t = await getTranslations();
  const format = await getFormatter();
  const unlocks = await getUnlocks();

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            {t('common.app.nav.unlocked')}
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">{t('jobs.unlocked.intro')}</p>
        </div>
        <ButtonLink href="/dashboard/jobs" size="lg" icon={Briefcase}>
          {t('jobs.unlocked.browse')}
        </ButtonLink>
      </div>
      {unlocks === null ? (
        <Alert tone="error">{t('jobs.public.unavailable')}</Alert>
      ) : unlocks.length === 0 ? (
        <EmptyState
          icon={Unlock}
          title={t('jobs.unlocked.empty')}
          description={t('jobs.unlocked.emptyBody')}
          className="bg-surface py-14"
          action={
            <ButtonLink href="/dashboard/jobs" icon={Briefcase}>
              {t('jobs.unlocked.browse')}
            </ButtonLink>
          }
        />
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2">
          {unlocks.map((entry) => (
            <div key={entry.offer.id} className="grid gap-1.5">
              <JobCard offer={entry.offer} base="/dashboard/jobs" />
              <p className="flex items-center gap-1.5 px-1 text-xs text-fg-subtle">
                <Unlock className="size-3.5" aria-hidden="true" />
                {t('jobs.unlocked.on', {
                  date: format.dateTime(new Date(entry.unlockedAt), { dateStyle: 'medium' }),
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
