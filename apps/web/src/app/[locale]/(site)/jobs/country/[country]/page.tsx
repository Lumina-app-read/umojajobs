import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { JobSearchView } from '@/features/jobs/job-search-view';
import { landingParams, landingRobots } from '@/features/jobs/landing';
import { queryString, type SearchParams } from '@/features/jobs/routes';
import { getCountries, getSitemapData } from '@/lib/api/server';
import { redirectSignedIn } from '@/lib/auth-guard';
import { publicPageMetadata } from '@/lib/seo';

type Params = Promise<{ locale: string; country: string }>;

async function country(locale: string, code: string) {
  if (!/^[a-z]{2}$/.test(code)) return null;
  const found = (await getCountries().catch(() => [])).find(
    (entry) => entry.iso2 === code.toUpperCase(),
  );
  return found ? { iso2: found.iso2, name: locale === 'en' ? found.nameEn : found.nameFr } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, country: code } = await params;
  const place = await country(locale, code);
  if (!place) return {};
  const t = await getTranslations('jobs.places');
  const total = (await getSitemapData())?.countries.find(
    (entry) => entry.iso2 === place.iso2,
  )?.count;
  return {
    ...publicPageMetadata({
      locale,
      path: `/jobs/country/${code}`,
      title: t('countryTitle', { name: place.name }),
      description: t('countryDescription', { name: place.name }),
    }),
    robots: landingRobots(total),
  };
}

/** Offres actives d'un pays. */
export default async function CountryJobsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, country: code } = await params;
  const place = await country(locale, code);
  if (!place) notFound();
  const query = landingParams({ country: place.iso2 }, await searchParams);
  await redirectSignedIn(`/dashboard/jobs${queryString(query)}`);
  const t = await getTranslations('jobs.places');
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <JobSearchView
        base="/jobs"
        params={query}
        heading={{
          title: t('countryTitle', { name: place.name }),
          intro: t('countryIntro', { name: place.name }),
        }}
      />
    </div>
  );
}
