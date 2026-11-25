import {
  CONTRACT_TYPES,
  type ContractType,
  WORK_MODES,
  type WorkMode,
} from '@opportinities/shared';
import { Archive, Globe2, SearchX } from 'lucide-react';
import { cookies } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { getCountries, getCurrentUser, getJobCategories, searchJobs } from '@/lib/api/server';
import { ActiveFilters, type ActiveFilter } from './active-filters';
import { ALL_COUNTRIES, JOB_COUNTRIES_COOKIE, resolveCountries } from './country-filter';
import { JobList } from './job-list';
import { type JobFilterValues, JobFilters } from './job-filters';
import { JobPagination } from './pagination';
import { firstParam, type JobsBase, pageParam, type SearchParams } from './routes';

const isContract = (value: unknown): value is ContractType =>
  (CONTRACT_TYPES as readonly unknown[]).includes(value);
const isWorkMode = (value: unknown): value is WorkMode =>
  (WORK_MODES as readonly unknown[]).includes(value);

/** Filtres lus dans l'adresse, validés avant d'être transmis à l'API. */
function readFilters(params: SearchParams, countries: string[]): JobFilterValues {
  const contractType = firstParam(params.contractType);
  const workMode = firstParam(params.workMode);
  return {
    q: (firstParam(params.q) ?? '').slice(0, 120),
    countries,
    cityId: /^[0-9a-f-]{36}$/i.test(firstParam(params.cityId) ?? '')
      ? (firstParam(params.cityId) as string)
      : null,
    category: firstParam(params.category) || null,
    contractType: isContract(contractType) ? contractType : null,
    workMode: isWorkMode(workMode) ? workMode : null,
    sort: firstParam(params.sort) === 'deadline' ? 'deadline' : 'recent',
  };
}

/** Liste des offres vérifiées : en-tête, filtres, résultats et pagination. */
export async function JobSearchView({
  base,
  params,
  heading,
}: {
  base: JobsBase;
  params: SearchParams;
  /** Titre propre aux pages par pays, ville ou catégorie. */
  heading?: { title: string; intro: string };
}) {
  const inApp = base === '/dashboard/jobs';
  const [t, tJobs, locale] = await Promise.all([
    getTranslations('jobs.public'),
    getTranslations('jobs'),
    getLocale(),
  ]);
  // Espace connecté : pays du profil (base de données) par défaut, ou préférence mémorisée.
  const homeCountry = inApp ? ((await getCurrentUser()).data?.countryIso2 ?? null) : undefined;
  const selection = resolveCountries({
    param: params.country,
    preference: inApp ? (await cookies()).get(JOB_COUNTRIES_COOKIE)?.value : undefined,
    homeCountry,
  });
  const filters = readFilters(params, selection.countries);
  const page = pageParam(params);

  const query = new URLSearchParams({ page: String(page), pageSize: '30' });
  if (filters.q) query.set('q', filters.q);
  for (const code of filters.countries) query.append('country', code);
  // Tous les pays choisis explicitement : l'adresse le garde (sinon le pays du profil revient).
  if (inApp && filters.countries.length === 0) query.set('country', ALL_COUNTRIES);
  if (filters.category) query.set('category', filters.category);
  if (filters.cityId) query.set('cityId', filters.cityId);
  if (filters.contractType) query.set('contractType', filters.contractType);
  if (filters.workMode) query.set('workMode', filters.workMode);
  if (filters.sort !== 'recent') query.set('sort', filters.sort);

  const apiQuery = new URLSearchParams(query);
  if (apiQuery.get('country') === ALL_COUNTRIES) apiQuery.delete('country');
  const [result, countries, categories] = await Promise.all([
    searchJobs(apiQuery.toString()),
    getCountries().catch(() => []),
    getJobCategories(),
  ]);
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const pageHref = (target: number) => {
    const next = new URLSearchParams(query);
    next.delete('pageSize');
    next.set('page', String(target));
    return `${base}?${next.toString()}`;
  };
  const href = (next: URLSearchParams) => {
    next.delete('pageSize');
    next.delete('page');
    const text = next.toString();
    return text ? `${base}?${text}` : base;
  };
  const without = (key: string, value?: string) => {
    const next = new URLSearchParams(query);
    if (value === undefined) next.delete(key);
    else {
      const rest = next.getAll(key).filter((item) => item !== value);
      next.delete(key);
      for (const item of rest) next.append(key, item);
      if (key === 'country' && rest.length === 0 && inApp) next.set('country', ALL_COUNTRIES);
    }
    return href(next);
  };
  const byCode = new Map(countries.map((country) => [country.iso2, country]));
  const nameOf = (item: { nameFr: string; nameEn: string }) =>
    locale === 'fr' ? item.nameFr : item.nameEn;
  const category = categories.find((item) => item.slug === filters.category);
  const active: ActiveFilter[] = [
    ...filters.countries.map((code) => {
      const country = byCode.get(code);
      return {
        key: `country-${code}`,
        label: country ? nameOf(country) : code,
        flag: country?.flagEmoji,
        href: without('country', code),
      };
    }),
    ...(filters.q ? [{ key: 'q', label: `« ${filters.q} »`, href: without('q') }] : []),
    ...(filters.category
      ? [
          {
            key: 'category',
            label: category ? nameOf(category) : filters.category,
            href: without('category'),
          },
        ]
      : []),
    ...(filters.contractType
      ? [
          {
            key: 'contractType',
            label: tJobs(`enums.contractType.${filters.contractType}`),
            href: without('contractType'),
          },
        ]
      : []),
    ...(filters.workMode
      ? [
          {
            key: 'workMode',
            label: tJobs(`enums.workMode.${filters.workMode}`),
            href: without('workMode'),
          },
        ]
      : []),
  ];
  const allCountriesHref = (() => {
    const next = new URLSearchParams(query);
    next.delete('country');
    if (inApp) next.set('country', ALL_COUNTRIES);
    return href(next);
  })();

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className={
              inApp
                ? 'text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]'
                : 'text-[28px] leading-9 font-bold tracking-[-0.02em] text-fg sm:text-display-lg'
            }
          >
            {heading?.title ?? t('title')}
          </h1>
          <p className={inApp ? 'mt-1.5 text-sm text-fg-muted' : 'mt-2 text-base text-fg-muted'}>
            {heading?.intro ?? t('intro')}
          </p>
        </div>
        <ButtonLink href={`${base}/archives`} variant="ghost" icon={Archive}>
          {t('archives')}
        </ButtonLink>
      </div>

      <JobFilters
        // Nouvelle adresse (navigation, retour arrière) : les champs repartent de l'adresse.
        key={query.toString()}
        base={base}
        initial={filters}
        countries={countries}
        categories={categories}
        homeCountry={homeCountry}
      />

      {active.length > 0 && (
        <ActiveFilters
          filters={active}
          clearHref={inApp ? `${base}?country=${ALL_COUNTRIES}` : base}
          note={inApp && !selection.explicit && homeCountry ? t('defaultCountryNote') : undefined}
        />
      )}

      {result === null ? (
        <Alert tone="error">{t('unavailable')}</Alert>
      ) : result.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={filters.countries.length > 0 ? t('emptyCountries') : t('empty')}
          description={filters.countries.length > 0 ? t('emptyCountriesBody') : t('emptyBody')}
          action={
            filters.countries.length > 0 ? (
              <ButtonLink href={allCountriesHref} variant="secondary" icon={Globe2}>
                {t('seeAllCountries')}
              </ButtonLink>
            ) : undefined
          }
          className="bg-surface py-16"
        />
      ) : (
        <>
          <p className="text-sm font-medium text-fg-muted" role="status">
            {t('results', { count: result.total })}
          </p>
          <JobList offers={result.items} base={base} />
          <JobPagination page={page} pages={pages} href={pageHref} />
        </>
      )}
    </div>
  );
}
