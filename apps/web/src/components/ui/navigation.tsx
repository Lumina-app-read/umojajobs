'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Progression d'un parcours en plusieurs étapes (barre segmentée et « Étape x sur y »). */
export function Stepper({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  const t = useTranslations('common.ui');
  const stepText = t('stepOf', { current, total });
  return (
    <div className="grid gap-2.5">
      <p className="text-xs font-semibold text-fg-subtle">
        <span className="text-brand">{stepText}</span> · {label}
      </p>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={`${stepText} : ${label}`}
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className="relative h-1 overflow-hidden rounded-full bg-surface-2">
            <span
              className={cn(
                'absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-[320ms] ease-emphasized',
                index < current ? 'scale-x-100' : 'scale-x-0',
              )}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Contrôle segmenté (filtres de vue : Toutes, Actives, Expirées). Groupe de boutons radio accessible. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-8 rounded-md px-3 text-sm sm:text-[13px] font-medium transition-[background-color,color,box-shadow] duration-[120ms]',
              selected ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
