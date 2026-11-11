import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JobArchivesView } from '@/features/jobs/job-archives-view';
import { queryString, type SearchParams } from '@/features/jobs/routes';
import { redirectSignedIn } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.public');
  return { title: t('archivesTitle'), robots: { index: false, follow: true } };
}

/** Archives publiques : offres expirées, consultables mais non déverrouillables. */
export default async function JobArchivesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  await redirectSignedIn(`/dashboard/jobs/archives${queryString(params)}`);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <JobArchivesView base="/jobs" params={params} />
    </div>
  );
}
