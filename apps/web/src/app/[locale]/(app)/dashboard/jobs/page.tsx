import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JobSearchView } from '@/features/jobs/job-search-view';
import type { SearchParams } from '@/features/jobs/routes';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.public');
  return { title: t('title') };
}

/** Offres d'emploi publiées, consultées depuis l'espace personnel. */
export default async function DashboardJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser();
  return <JobSearchView base="/dashboard/jobs" params={await searchParams} />;
}
