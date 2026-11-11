import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JobArchivesView } from '@/features/jobs/job-archives-view';
import type { SearchParams } from '@/features/jobs/routes';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.public');
  return { title: t('archivesTitle') };
}

/** Archives des offres, depuis l'espace personnel. */
export default async function DashboardJobArchivesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser();
  return <JobArchivesView base="/dashboard/jobs" params={await searchParams} />;
}
