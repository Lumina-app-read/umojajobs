'use client';

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Field,
  Label,
} from '@headlessui/react';
import { type CountryResponse } from '@opportinities/shared';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { inputClasses } from '@/components/ui/form-field';
import { cn } from '@/lib/cn';

/** Minuscules sans accents : « Côte d'Ivoire », « cote d ivoire » et « COTE » se retrouvent. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}+]+/gu, ' ')
    .trim();
}

export function countryName(country: CountryResponse, locale: string): string {
  return locale === 'fr' ? country.nameFr : country.nameEn;
}

/** Filtre sur les noms français et anglais, le code ISO et l'indicatif téléphonique. */
export function filterCountries(countries: CountryResponse[], query: string): CountryResponse[] {
  const term = normalizeSearch(query);
  if (!term) return countries;
  return countries.filter((country) =>
    [country.nameFr, country.nameEn, country.iso2, country.iso3, country.dialCode].some((value) =>
      normalizeSearch(value).includes(term),
    ),
  );
}

interface CountrySelectProps {
  countries: CountryResponse[];
  value: string;
  onChange: (iso2: string) => void;
  label: string;
  name?: string;
  error?: string | null;
}

/** Sélecteur de pays recherchable et accessible au clavier, avec drapeau et indicatif. */
export function CountrySelect({
  countries,
  value,
  onChange,
  label,
  name,
  error,
}: CountrySelectProps) {
  const t = useTranslations('auth.country');
  const locale = useLocale();
  const errorId = useId();
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => {
    const collator = new Intl.Collator(locale, { sensitivity: 'base' });
    return [...countries].sort((a, b) =>
      collator.compare(countryName(a, locale), countryName(b, locale)),
    );
  }, [countries, locale]);

  const filtered = useMemo(() => filterCountries(sorted, query), [sorted, query]);
  const selected = sorted.find((country) => country.iso2 === value) ?? null;

  return (
    <Field className="space-y-1.5">
      <Label className="block text-sm font-medium text-foreground">{label}</Label>
      <Combobox
        value={selected}
        onChange={(country: CountryResponse | null) => onChange(country?.iso2 ?? '')}
        onClose={() => setQuery('')}
        name={name}
        by="iso2"
      >
        <div className="relative">
          <ComboboxInput
            className={cn(inputClasses(Boolean(error)), 'pr-10')}
            displayValue={(country: CountryResponse | null) =>
              country ? `${country.flagEmoji} ${countryName(country, locale)}` : ''
            }
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('placeholder')}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          <ComboboxButton className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted">
            <ChevronsUpDown className="size-4" aria-hidden="true" />
          </ComboboxButton>
        </div>
        <ComboboxOptions
          anchor="bottom start"
          className="z-50 mt-1 max-h-72 w-(--input-width) overflow-auto rounded-md border border-border bg-surface py-1 shadow-lg empty:invisible"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted">{t('noResult')}</div>
          ) : (
            filtered.map((country) => (
              <ComboboxOption
                key={country.iso2}
                value={country}
                className="group flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-foreground data-focus:bg-surface-muted"
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {country.flagEmoji}
                </span>
                <span className="flex-1">{countryName(country, locale)}</span>
                <span className="text-xs text-muted">{country.dialCode}</span>
                <Check
                  className="invisible size-4 text-primary group-data-selected:visible"
                  aria-hidden="true"
                />
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </Combobox>
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </Field>
  );
}
