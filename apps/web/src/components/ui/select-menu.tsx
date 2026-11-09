'use client';

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { Check, type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SelectMenuOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Langue du libellé (« English » affiché dans une page en français). */
  lang?: string;
}

/** Surface des menus déroulants : surface élevée, rayon 8 px, ombre moyenne, apparition de 200 ms. */
export const menuSurfaceClasses = cn(
  'z-50 min-w-44 rounded-lg border border-line bg-surface-raised p-1 shadow-md outline-none',
  'origin-top transition duration-200 ease-emphasized data-closed:scale-[0.97] data-closed:opacity-0',
);

export const menuItemClasses = cn(
  'group flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-fg select-none',
  'data-focus:bg-surface-2',
);

/**
 * Menu de sélection d'une valeur (thème, langue, tri) : un seul bouton déclencheur,
 * liste accessible au clavier (Headless UI Listbox), coche sur l'option active.
 */
export function SelectMenu<T extends string>({
  value,
  onChange,
  options,
  label,
  trigger,
  triggerClassName,
  anchor = 'bottom end',
  disabled,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectMenuOption<T>[];
  /** Titre affiché en tête de liste et utilisé comme nom accessible du bouton. */
  label: string;
  trigger: ReactNode;
  triggerClassName?: string;
  anchor?: 'bottom end' | 'bottom start';
  disabled?: boolean;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <ListboxButton
        aria-label={`${label} : ${current?.label ?? ''}`}
        title={label}
        className={triggerClassName}
      >
        {trigger}
      </ListboxButton>
      <ListboxOptions anchor={{ to: anchor, gap: 6 }} transition className={menuSurfaceClasses}>
        <div className="px-2 pb-1 pt-1.5 text-xs font-medium text-fg-subtle" aria-hidden="true">
          {label}
        </div>
        {options.map(({ value: optionValue, label: optionLabel, icon: Icon, lang }) => (
          <ListboxOption key={optionValue} value={optionValue} className={menuItemClasses}>
            {Icon && <Icon className="size-4 text-fg-subtle" aria-hidden="true" />}
            <span lang={lang}>{optionLabel}</span>
            <Check
              className="invisible ml-auto size-4 text-brand group-data-selected:visible"
              aria-hidden="true"
            />
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
