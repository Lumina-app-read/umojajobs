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
import { ArrowDownUp, Globe2, Laptop, Layers, RotateCcw, ScrollText, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormSelect } from '@/components/ui/form-controls';
import { FormField } from '@/components/ui/form-field';
import { useRouter } from '@/i18n/navigation';
import type { JobsBase } from './routes';

export interface JobFilterValues {
  q: string;
  country: string | null;
  category: string | null;
  contractType: ContractType | null;
  workMode: WorkMode | null;
  sort: JobSearchSort;
}

/**
 * Filtres de recherche. Ils se traduisent en paramètres d'adresse : une recherche se partage
 * par un simple lien et la page reste rendue par le serveur (référencement).
 */
export function JobFilters({
  base,
  initial,
  countries,
  categories,
}: {
  base: JobsBase;
  initial: JobFilterValues;
  countries: CountryResponse[];
  categories: JobCategoryResponse[];
}) {
  const t = useTranslations('jobs');
  const locale = useLocale();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const set = <K extends keyof JobFilterValues>(key: K, value: JobFilterValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  function apply(next: JobFilterValues) {
    const query: Record<string, string> = {};
    if (next.q.trim()) query.q = next.q.trim();
    if (next.country) query.country = next.country;
    if (next.category) query.category = next.category;
    if (next.contractType) query.contractType = next.contractType;
    if (next.workMode) query.workMode = next.workMode;
    if (next.sort !== 'recent') query.sort = next.sort;
    router.push({ pathname: base, query });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(values);
  }

  const reset: JobFilterValues = {
    q: '',
    country: null,
    category: null,
    contractType: null,
    workMode: null,
    sort: 'recent',
  };

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className="grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-xs"
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
        <Button type="submit" size="lg" icon={Search}>
          {t('public.search')}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <FormSelect
          label={t('public.country')}
          icon={Globe2}
          placeholder={t('public.allCountries')}
          value={values.country}
          onChange={(value) => set('country', value)}
          options={countries.map((country) => ({
            value: country.iso2,
            label: `${country.flagEmoji} ${locale === 'fr' ? country.nameFr : country.nameEn}`,
          }))}
          allowEmpty
        />
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
        <Button
          variant="ghost"
          size="sm"
          icon={RotateCcw}
          onClick={() => {
            setValues(reset);
            apply(reset);
          }}
        >
          {t('public.reset')}
        </Button>
      </div>
    </form>
  );
}
