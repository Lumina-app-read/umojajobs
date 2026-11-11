import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JobSearchView } from '@/features/jobs/job-search-view';
import { queryString, type SearchParams } from '@/features/jobs/routes';
import { redirectSignedIn } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.public');
  return {
    title: t('title'),
    description: t('metaDescription'),
    alternates: { canonical: '/jobs' },
  };
}

/** Vitrine publique des offres (visiteurs et moteurs de recherche). */
export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  await redirectSignedIn(`/dashboard/jobs${queryString(params)}`);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <JobSearchView base="/jobs" params={params} />
    </div>
  );
}
