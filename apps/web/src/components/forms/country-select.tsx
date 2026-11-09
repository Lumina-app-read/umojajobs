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
import { Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { controlFrameClasses, controlInputClasses, FieldError } from '@/components/ui/form-field';
import { menuItemClasses, menuSurfaceClasses } from '@/components/ui/select-menu';
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
    <Field className="grid gap-1.5">
      <Label className="block text-[13px] font-semibold text-fg">{label}</Label>
      <Combobox
        value={selected}
        onChange={(country: CountryResponse | null) => onChange(country?.iso2 ?? '')}
        onClose={() => setQuery('')}
        name={name}
        by="iso2"
      >
        <div className={controlFrameClasses(Boolean(error))}>
          <MapPin className="ml-3 size-4 text-fg-subtle" aria-hidden="true" />
          <ComboboxInput
            className={cn(controlInputClasses, 'pl-2 pr-1')}
            displayValue={(country: CountryResponse | null) =>
              country ? `${country.flagEmoji} ${countryName(country, locale)}` : ''
            }
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('placeholder')}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          <ComboboxButton className="flex h-full w-9 items-center justify-center text-fg-subtle">
            <ChevronsUpDown className="size-4" aria-hidden="true" />
          </ComboboxButton>
        </div>
        <ComboboxOptions
          anchor={{ to: 'bottom start', gap: 6 }}
          transition
          className={cn(
            menuSurfaceClasses,
            'max-h-72 w-(--input-width) overflow-auto empty:invisible',
          )}
        >
          {filtered.length === 0 ? (
            <div className="px-2 py-2 text-[13px] text-fg-muted">{t('noResult')}</div>
          ) : (
            filtered.map((country) => (
              <ComboboxOption key={country.iso2} value={country} className={menuItemClasses}>
                <span aria-hidden="true" className="w-5 text-center text-base leading-none">
                  {country.flagEmoji}
                </span>
                <span className="min-w-0 flex-1 truncate">{countryName(country, locale)}</span>
                <span className="text-xs text-fg-subtle tabular-nums">{country.dialCode}</span>
                <Check
                  className="invisible size-4 text-brand group-data-selected:visible"
                  aria-hidden="true"
                />
              </ComboboxOption>
            ))
          )}
        </ComboboxOptions>
      </Combobox>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
