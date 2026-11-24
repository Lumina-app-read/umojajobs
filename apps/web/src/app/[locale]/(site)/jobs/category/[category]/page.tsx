import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { JobSearchView } from '@/features/jobs/job-search-view';
import { landingParams, landingRobots } from '@/features/jobs/landing';
import { queryString, type SearchParams } from '@/features/jobs/routes';
import { getJobCategories, getSitemapData } from '@/lib/api/server';
import { redirectSignedIn } from '@/lib/auth-guard';
import { publicPageMetadata } from '@/lib/seo';

type Params = Promise<{ locale: string; category: string }>;

async function category(locale: string, slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const found = (await getJobCategories()).find((entry) => entry.slug === slug);
  return found ? { slug, name: locale === 'en' ? found.nameEn : found.nameFr } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, category: slug } = await params;
  const found = await category(locale, slug);
  if (!found) return {};
  const t = await getTranslations('jobs.places');
  const total = (await getSitemapData())?.categories.find((entry) => entry.slug === slug)?.count;
  return {
    ...publicPageMetadata({
      locale,
      path: `/jobs/category/${slug}`,
      title: t('categoryTitle', { name: found.name }),
      description: t('categoryDescription', { name: found.name }),
    }),
    robots: landingRobots(total),
  };
}

/** Offres actives d'une catégorie. */
export default async function CategoryJobsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, category: slug } = await params;
  const found = await category(locale, slug);
  if (!found) notFound();
  const query = landingParams({ category: slug }, await searchParams);
  await redirectSignedIn(`/dashboard/jobs${queryString(query)}`);
  const t = await getTranslations('jobs.places');
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <JobSearchView
        base="/jobs"
        params={query}
        heading={{
          title: t('categoryTitle', { name: found.name }),
          intro: t('categoryIntro', { name: found.name }),
        }}
      />
    </div>
  );
}
