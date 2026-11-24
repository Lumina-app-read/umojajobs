import { flagEmoji } from '@opportinities/shared';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getCountries, getJobCategories, getSitemapData } from '@/lib/api/server';

const SHOWN = 12;

/** Liens vers les pages par pays, ville et catégorie qui ont des offres (navigation et moteurs). */
export async function JobPlaces() {
  const [t, locale, data, countries, categories] = await Promise.all([
    getTranslations('jobs.places'),
    getLocale(),
    getSitemapData(),
    getCountries().catch(() => []),
    getJobCategories(),
  ]);
  if (!data || (data.countries.length === 0 && data.categories.length === 0)) return null;
  const countryName = (iso2: string) => {
    const country = countries.find((entry) => entry.iso2 === iso2);
    return country ? (locale === 'en' ? country.nameEn : country.nameFr) : iso2;
  };
  const categoryName = (slug: string) => {
    const category = categories.find((entry) => entry.slug === slug);
    return category ? (locale === 'en' ? category.nameEn : category.nameFr) : slug;
  };
  const groups = [
    {
      title: t('byCountry'),
      links: data.countries.slice(0, SHOWN).map((country) => ({
        href: `/jobs/country/${country.iso2.toLowerCase()}`,
        label: `${flagEmoji(country.iso2)} ${countryName(country.iso2)}`,
        count: country.count,
      })),
    },
    {
      title: t('byCity'),
      links: data.cities.slice(0, SHOWN).map((city) => ({
        href: `/jobs/country/${city.countryIso2.toLowerCase()}/${city.slug}`,
        label: city.name,
        count: city.count,
      })),
    },
    {
      title: t('byCategory'),
      links: data.categories.slice(0, SHOWN).map((category) => ({
        href: `/jobs/category/${category.slug}`,
        label: categoryName(category.slug),
        count: category.count,
      })),
    },
  ].filter((group) => group.links.length > 0);

  return (
    <nav aria-labelledby="job-places" className="mt-14 grid gap-6 border-t border-line pt-10">
      <h2 id="job-places" className="text-lg font-semibold text-fg">
        {t('title')}
      </h2>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-3 text-sm font-semibold text-fg-muted">{group.title}</h3>
            <ul className="grid gap-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-brand hover:underline">
                    {link.label}
                  </Link>
                  <span className="ml-1.5 text-xs text-fg-subtle tabular-nums">({link.count})</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
