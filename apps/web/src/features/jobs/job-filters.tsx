'use client';

import {
  CONTRACT_TYPES,
  type ContractType,
  type CountryResponse,
  type JobCategoryResponse,
  type JobSearchSort,
  WORK_MODES,
  type WorkMode,
} from '@opportinities/shared';
import {
  ArrowDownUp,
  Globe2,
  House,
  Laptop,
  Layers,
  ListChecks,
  type LucideIcon,
  RotateCcw,
  ScrollText,
  Search,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState, useTransition } from 'react';
import { countryName, CountryMultiSelect } from '@/components/forms/country-select';
import { Button } from '@/components/ui/button';
import { FormSelect } from '@/components/ui/form-controls';
import { FormField } from '@/components/ui/form-field';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { setConsentedCookie } from '@/lib/consent';
import {
  countryQuery,
  type CountryScope,
  countryScope,
  JOB_COUNTRIES_COOKIE,
  JOB_COUNTRIES_MAX_AGE_SECONDS,
  serializeCountryPreference,
} from './country-filter';
import type { JobsBase } from './routes';

export interface JobFilterValues {
  /** Ville imposée par une page par ville (non modifiable dans les filtres). */
  cityId?: string | null;
  q: string;
  /** Pays retenus ; vide = tous les pays. */
  countries: string[];
  category: string | null;
  contractType: ContractType | null;
  workMode: WorkMode | null;
  sort: JobSearchSort;
}

const SCOPE_ICON: Record<CountryScope, LucideIcon> = {
  mine: House,
  all: Globe2,
  custom: ListChecks,
};

/**
 * Filtres de recherche. Ils se traduisent en paramètres d'adresse : une recherche se partage
 * par un simple lien, la page reste rendue par le serveur (référencement) et la navigation ne
 * recharge que les résultats. Dans l'espace connecté, le pays du profil s'applique par défaut et
 * le choix de pays est mémorisé si l'utilisateur a accepté les cookies fonctionnels.
 */
export function JobFilters({
  base,
  initial,
  countries,
  categories,
  homeCountry,
}: {
  base: JobsBase;
  initial: JobFilterValues;
  countries: CountryResponse[];
  categories: JobCategoryResponse[];
  /** Pays du profil (espace connecté uniquement). */
  homeCountry?: string | null;
}) {
  const t = useTranslations('jobs');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const [scope, setScope] = useState<CountryScope>(() =>
    countryScope(initial.countries, homeCountry),
  );
  const inApp = homeCountry !== undefined;
  /** Dernière sélection de pays appliquée : la fermeture de la liste ne relance rien si elle n'a pas changé. */
  const appliedCountries = useRef(initial.countries.join(','));
  const set = <K extends keyof JobFilterValues>(key: K, value: JobFilterValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function apply(next: JobFilterValues) {
    const query: Record<string, string | string[]> = {};
    if (next.q.trim()) query.q = next.q.trim();
    // Site public : « tous les pays » est le défaut, inutile dans l'adresse.
    if (inApp || next.countries.length > 0) query.country = countryQuery(next.countries);
    if (next.category) query.category = next.category;
    if (next.contractType) query.contractType = next.contractType;
    if (next.workMode) query.workMode = next.workMode;
    if (next.sort !== 'recent') query.sort = next.sort;
    appliedCountries.current = next.countries.join(',');
    if (inApp) {
      setConsentedCookie(
        'functional',
        JOB_COUNTRIES_COOKIE,
        serializeCountryPreference(next.countries),
        JOB_COUNTRIES_MAX_AGE_SECONDS,
      );
    }
    startTransition(() => router.push({ pathname: base, query }, { scroll: false }));
  }

  function applyCountries(next: string[]) {
    const updated = { ...values, countries: next };
    setValues(updated);
    apply(updated);
  }

  function chooseScope(next: CountryScope) {
    setScope(next);
    if (next === 'mine' && homeCountry) applyCountries([homeCountry]);
    else if (next === 'all') applyCountries([]);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(values);
  }

  function reset() {
    const cleared: JobFilterValues = {
      q: '',
      countries: homeCountry ? [homeCountry] : [],
      category: null,
      contractType: null,
      workMode: null,
      sort: 'recent',
    };
    setValues(cleared);
    setScope(countryScope(cleared.countries, homeCountry));
    // Préférence oubliée : le pays du profil redevient le choix par défaut.
    if (inApp) document.cookie = `${JOB_COUNTRIES_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    startTransition(() => router.push({ pathname: base }, { scroll: false }));
  }

  const byCode = new Map(countries.map((country) => [country.iso2, country]));
  const home = homeCountry ? byCode.get(homeCountry) : undefined;
  const scopes: CountryScope[] = home ? ['mine', 'all', 'custom'] : ['all', 'custom'];

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className="grid gap-4 rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5"
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <FormField
          label={t('public.searchLabel')}
          name="q"
          type="search"
          icon={Search}
          placeholder={t('public.searchPlaceholder')}
          value={values.q}
          maxLength={120}
          onChange={(event) => set('q', event.target.value)}
        />
        <Button type="submit" size="lg" icon={Search} loading={pending}>
          {t('public.search')}
        </Button>
      </div>

      <fieldset className="grid min-w-0 gap-2.5">
        <legend className="mb-2 text-sm font-semibold text-fg sm:text-[13px]">
          {t('public.country')}
        </legend>
        <div
          role="radiogroup"
          aria-label={t('public.country')}
          className="grid grid-cols-1 gap-1 rounded-lg bg-surface-2 p-1 min-[420px]:grid-cols-3"
        >
          {scopes.map((option) => {
            const Icon = SCOPE_ICON[option];
            const active = scope === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                title={option === 'mine' && home ? countryName(home, locale) : undefined}
                onClick={() => chooseScope(option)}
                className={cn(
                  'flex h-10 min-w-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors sm:h-9 sm:text-[13px]',
                  active ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg',
                )}
              >
                {option === 'mine' && home ? (
                  <span aria-hidden="true" className="text-base leading-none">
                    {home.flagEmoji}
                  </span>
                ) : (
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                )}
                <span className="truncate">{t(`public.scope.${option}`)}</span>
              </button>
            );
          })}
        </div>

        {scope === 'custom' && (
          <div className="grid gap-2.5 animate-fade-in">
            <CountryMultiSelect
              countries={countries}
              value={values.countries}
              onChange={(next) => set('countries', next)}
              onClose={() => {
                if (values.countries.join(',') !== appliedCountries.current) apply(values);
              }}
              label={t('public.country')}
              placeholder={t('public.countriesPlaceholder')}
              selectedLabel={(count) => t('public.countriesSelected', { count })}
            />
            {values.countries.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label={t('public.countriesChosen')}>
                {values.countries.map((code) => {
                  const country = byCode.get(code);
                  const name = country ? countryName(country, locale) : code;
                  return (
                    <li key={code}>
                      <button
                        type="button"
                        onClick={() =>
                          applyCountries(values.countries.filter((item) => item !== code))
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface pl-2.5 pr-2 text-[13px] text-fg transition-colors hover:border-line-strong hover:bg-surface-2"
                        aria-label={t('public.removeFilter', { label: name })}
                      >
                        <span aria-hidden="true">{country?.flagEmoji}</span>
                        {name}
                        <X className="size-3.5 text-fg-subtle" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormSelect
          label={t('public.category')}
          icon={Layers}
          placeholder={t('public.allCategories')}
          value={values.category}
          onChange={(value) => set('category', value)}
          options={categories.map((category) => ({
            value: category.slug,
            label: locale === 'fr' ? category.nameFr : category.nameEn,
          }))}
          allowEmpty
        />
        <FormSelect
          label={t('public.contractType')}
          icon={ScrollText}
          placeholder={t('public.allContracts')}
          value={values.contractType}
          onChange={(value) => set('contractType', value)}
          options={CONTRACT_TYPES.map((value) => ({
            value,
            label: t(`enums.contractType.${value}`),
          }))}
          allowEmpty
        />
        <FormSelect
          label={t('public.workMode')}
          icon={Laptop}
          placeholder={t('public.allModes')}
          value={values.workMode}
          onChange={(value) => set('workMode', value)}
          options={WORK_MODES.map((value) => ({ value, label: t(`enums.workMode.${value}`) }))}
          allowEmpty
        />
        <FormSelect<JobSearchSort>
          label={t('public.sort')}
          icon={ArrowDownUp}
          placeholder={t('public.sortRecent')}
          value={values.sort}
          onChange={(value) => set('sort', value ?? 'recent')}
          options={[
            { value: 'recent', label: t('public.sortRecent') },
            { value: 'deadline', label: t('public.sortDeadline') },
          ]}
        />
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={reset}>
          {t('public.reset')}
        </Button>
      </div>
    </form>
  );
}
