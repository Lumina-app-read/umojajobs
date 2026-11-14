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
import { type CityResponse } from '@opportinities/shared';
import { Building2, Check, ChevronsUpDown, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import {
  controlFrameClasses,
  controlInputClasses,
  FieldError,
  FieldHint,
} from '@/components/ui/form-field';
import { menuItemClasses, menuSurfaceClasses } from '@/components/ui/select-menu';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/cn';

export interface CityValue {
  id: string;
  name: string;
}

/**
 * Ville d'un pays, recherchée dans le référentiel (GeoNames) au fil de la saisie.
 * Inactive tant qu'aucun pays n'est choisi.
 */
export function CitySelect({
  countryIso2,
  value,
  onChange,
  label,
  placeholder,
  hint,
  disabledHint,
  clearLabel,
  error,
  optionalLabel,
}: {
  countryIso2: string | null;
  value: CityValue | null;
  onChange: (city: CityValue | null) => void;
  label: string;
  placeholder: string;
  hint?: string;
  disabledHint: string;
  clearLabel: string;
  error?: string | null;
  optionalLabel?: string;
}) {
  const errorId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityResponse[]>([]);

  // Recherche avec un court délai : une requête par pause de frappe, pas par touche.
  useEffect(() => {
    if (!countryIso2) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ limit: '20' });
      if (query.trim()) params.set('q', query.trim());
      api
        .get<CityResponse[]>(`/countries/${countryIso2}/cities?${params.toString()}`)
        .then((cities) => {
          if (!controller.signal.aborted) setResults(cities);
        })
        .catch(() => undefined);
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [countryIso2, query]);

  const disabled = !countryIso2;
  return (
    <Field className="grid min-w-0 gap-1.5" disabled={disabled}>
      <Label className="block text-sm sm:text-[13px] font-semibold text-fg">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-fg-subtle">{optionalLabel}</span>}
      </Label>
      <Combobox
        value={value}
        onChange={(city: CityValue | null) =>
          onChange(city ? { id: city.id, name: city.name } : null)
        }
        onClose={() => setQuery('')}
        by="id"
        disabled={disabled}
      >
        <div className={controlFrameClasses(Boolean(error), disabled)}>
          <Building2
            className="ml-3 size-[18px] shrink-0 text-fg-subtle sm:size-4"
            aria-hidden="true"
          />
          <ComboboxInput
            className={cn(controlInputClasses, 'pl-2 pr-1')}
            displayValue={(city: CityValue | null) => city?.name ?? ''}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          {value && !disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="grid size-8 place-items-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
              aria-label={clearLabel}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
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
          {results.map((city) => (
            <ComboboxOption key={city.id} value={city} className={menuItemClasses}>
              <span className="min-w-0 flex-1 truncate">{city.name}</span>
              {city.regionName && (
                <span className="truncate text-xs text-fg-subtle">{city.regionName}</span>
              )}
              <Check
                className="invisible size-4 text-brand group-data-selected:visible"
                aria-hidden="true"
              />
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </Combobox>
      {!error && <FieldHint>{disabled ? disabledHint : hint}</FieldHint>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
