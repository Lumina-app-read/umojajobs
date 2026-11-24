import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { JobSearchView } from '@/features/jobs/job-search-view';
import { landingParams, landingRobots } from '@/features/jobs/landing';
import { queryString, type SearchParams } from '@/features/jobs/routes';
import { getCountries, getPlaceCity, getSitemapData } from '@/lib/api/server';
import { redirectSignedIn } from '@/lib/auth-guard';
import { publicPageMetadata } from '@/lib/seo';

type Params = Promise<{ locale: string; country: string; city: string }>;

async function place(locale: string, code: string, slug: string) {
  if (!/^[a-z]{2}$/.test(code) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const [city, countries] = await Promise.all([
    getPlaceCity(code.toUpperCase(), slug),
    getCountries().catch(() => []),
  ]);
  const country = countries.find((entry) => entry.iso2 === code.toUpperCase());
  if (!city || !country) return null;
  return {
    city,
    name: `${city.name}, ${locale === 'en' ? country.nameEn : country.nameFr}`,
  };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, country: code, city: slug } = await params;
  const found = await place(locale, code, slug);
  if (!found) return {};
  const t = await getTranslations('jobs.places');
  const total = (await getSitemapData())?.cities.find(
    (entry) => entry.countryIso2 === found.city.countryIso2 && entry.slug === found.city.slug,
  )?.count;
  return {
    ...publicPageMetadata({
      locale,
      path: `/jobs/country/${code}/${found.city.slug}`,
      title: t('cityTitle', { name: found.name }),
      description: t('cityDescription', { name: found.name }),
    }),
    robots: landingRobots(total),
  };
}

/** Offres actives d'une ville. */
export default async function CityJobsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<SearchParams>;
}) {
  const { locale, country: code, city: slug } = await params;
  const found = await place(locale, code, slug);
  if (!found) notFound();
  const query = landingParams(
    { country: found.city.countryIso2, cityId: found.city.id },
    await searchParams,
  );
  await redirectSignedIn(`/dashboard/jobs${queryString(query)}`);
  const t = await getTranslations('jobs.places');
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <JobSearchView
        base="/jobs"
        params={query}
        heading={{
          title: t('cityTitle', { name: found.name }),
          intro: t('cityIntro', { name: found.name }),
        }}
      />
    </div>
  );
}
