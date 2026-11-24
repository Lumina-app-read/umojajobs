import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JobSearchView } from '@/features/jobs/job-search-view';
import { queryString, type SearchParams } from '@/features/jobs/routes';
import { JobPlaces } from '@/features/jobs/job-places';
import { redirectSignedIn } from '@/lib/auth-guard';
import { publicPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = await getTranslations('jobs.public');
  return publicPageMetadata({
    locale: (await params).locale,
    path: '/jobs',
    title: t('title'),
    description: t('metaDescription'),
  });
}

/** Vitrine publique des offres (visiteurs et moteurs de recherche). */
export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  await redirectSignedIn(`/dashboard/jobs${queryString(params)}`);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <JobSearchView base="/jobs" params={params} />
      <JobPlaces />
    </div>
  );
}
