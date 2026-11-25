import { type SitemapResponse } from '@opportinities/shared';
import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { API_INTERNAL_URL, publicHeaders } from '@/lib/api/internal';
import { SITE_URL } from '@/lib/seo';

/** Régénéré au plus toutes les 10 minutes. */
export const revalidate = 600;

async function data(): Promise<SitemapResponse | null> {
  const response = await fetch(`${API_INTERNAL_URL}/api/v1/job-offers/sitemap`, {
    headers: publicHeaders(),
    next: { revalidate },
  }).catch(() => null);
  return response?.ok ? ((await response.json()) as SitemapResponse) : null;
}

/** Une entrée par page, avec ses versions française et anglaise. */
function entry(
  path: string,
  options: Pick<MetadataRoute.Sitemap[number], 'lastModified' | 'changeFrequency' | 'priority'>,
): MetadataRoute.Sitemap[number] {
  const languages = Object.fromEntries(
    routing.locales.map((locale) => [locale, `${SITE_URL}/${locale}${path}`]),
  );
  return {
    url: `${SITE_URL}/${routing.defaultLocale}${path}`,
    alternates: { languages },
    ...options,
  };
}

/**
 * Plan du site : pages publiques, offres actives et pages par pays, ville et catégorie qui ont au
 * moins une offre. Les offres expirées n'y figurent jamais (elles restent consultables, non indexées).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages = [
    entry('', { changeFrequency: 'daily', priority: 1 }),
    entry('/jobs', { changeFrequency: 'hourly', priority: 0.9 }),
    entry('/terms', { changeFrequency: 'yearly', priority: 0.2 }),
    entry('/privacy', { changeFrequency: 'yearly', priority: 0.2 }),
  ];
  const result = await data();
  if (!result) return pages;
  return [
    ...pages,
    ...result.countries.map((country) =>
      entry(`/jobs/country/${country.iso2.toLowerCase()}`, {
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.7,
      }),
    ),
    ...result.cities.map((city) =>
      entry(`/jobs/country/${city.countryIso2.toLowerCase()}/${city.slug}`, {
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.6,
      }),
    ),
    ...result.categories.map((category) =>
      entry(`/jobs/category/${category.slug}`, {
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.7,
      }),
    ),
    ...result.offers.map((offer) =>
      entry(`/jobs/${offer.slug}`, {
        lastModified: new Date(offer.updatedAt),
        changeFrequency: 'weekly',
        priority: 0.8,
      }),
    ),
  ];
}
