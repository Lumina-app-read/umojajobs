import { Bookmark, Briefcase } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { JobCard } from '@/features/jobs/job-card';
import { getSavedJobs } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.app.nav');
  return { title: t('saved') };
}

/** Offres enregistrées : actives ou expirées (affichées comme telles). */
export default async function SavedJobsPage() {
  await requireUser();
  const t = await getTranslations();
  const saved = await getSavedJobs();

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            {t('common.app.nav.saved')}
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">{t('jobs.saved.intro')}</p>
        </div>
        <ButtonLink href="/dashboard/jobs" size="lg" icon={Briefcase}>
          {t('jobs.saved.browse')}
        </ButtonLink>
      </div>
      {saved === null ? (
        <Alert tone="error">{t('jobs.public.unavailable')}</Alert>
      ) : saved.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={t('jobs.saved.empty')}
          description={t('jobs.saved.emptyBody')}
          className="bg-surface py-14"
          action={
            <ButtonLink href="/dashboard/jobs" icon={Briefcase}>
              {t('jobs.saved.browse')}
            </ButtonLink>
          }
        />
      ) : (
        <div className="stagger grid gap-4 md:grid-cols-2">
          {saved.map((entry) => (
            <JobCard key={entry.offer.id} offer={entry.offer} base="/dashboard/jobs" />
          ))}
        </div>
      )}
    </div>
  );
}
