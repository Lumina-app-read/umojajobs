'use client';

import {
  Field,
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from '@headlessui/react';
import { Check, ChevronsUpDown, type LucideIcon } from 'lucide-react';
import { type TextareaHTMLAttributes, useId } from 'react';
import { cn } from '@/lib/cn';
import { controlFrameClasses, FieldError, FieldHint, FieldLabel } from './form-field';
import { menuItemClasses, menuSurfaceClasses } from './select-menu';

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  name: string;
  /** Règle du design system : icône et exemple de saisie obligatoires. */
  icon: LucideIcon;
  placeholder: string;
  error?: string | null;
  hint?: string;
  optionalLabel?: string;
}

/** Champ de texte long : mêmes états que FormField, hauteur ajustable verticalement. */
export function TextAreaField({
  label,
  name,
  icon: Icon,
  error,
  hint,
  optionalLabel,
  className,
  rows = 6,
  ...props
}: TextAreaFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('grid min-w-0 gap-1.5', className)}>
      <FieldLabel htmlFor={id} optional={optionalLabel}>
        {label}
      </FieldLabel>
      <div className={cn(controlFrameClasses(Boolean(error)), 'h-auto items-start')}>
        <Icon
          className="mt-3 ml-3 size-[18px] shrink-0 text-fg-subtle sm:size-4"
          aria-hidden="true"
        />
        <textarea
          id={id}
          name={name}
          rows={rows}
          className="min-h-24 w-full resize-y bg-transparent px-2 py-2.5 text-base leading-6 text-fg outline-none placeholder:text-fg-subtle sm:text-sm"
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          {...props}
        />
      </div>
      {hint && !error && <FieldHint id={hintId}>{hint}</FieldHint>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export interface FormSelectOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Liste déroulante de formulaire (Headless UI Listbox), habillée comme les champs :
 * icône à gauche, texte d'invite tant que rien n'est choisi, navigation au clavier.
 */
export function FormSelect<T extends string>({
  label,
  icon: Icon,
  placeholder,
  value,
  onChange,
  options,
  error,
  hint,
  optionalLabel,
  allowEmpty = false,
}: {
  label: string;
  icon: LucideIcon;
  placeholder: string;
  value: T | null;
  onChange: (value: T | null) => void;
  options: FormSelectOption<T>[];
  error?: string | null;
  hint?: string;
  optionalLabel?: string;
  /** Ajoute une option « non précisé » (l'invite) pour revenir à aucune valeur. */
  allowEmpty?: boolean;
}) {
  const errorId = useId();
  const current = options.find((option) => option.value === value) ?? null;
  return (
    <Field className="grid min-w-0 gap-1.5">
      <Label className="block text-sm sm:text-[13px] font-semibold text-fg">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-fg-subtle">{optionalLabel}</span>}
      </Label>
      <Listbox value={value} onChange={onChange}>
        <ListboxButton
          className={cn(controlFrameClasses(Boolean(error)), 'pr-2 text-left')}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
        >
          <Icon className="ml-3 size-[18px] shrink-0 text-fg-subtle sm:size-4" aria-hidden="true" />
          <span
            className={cn(
              'min-w-0 flex-1 truncate px-2 text-base sm:text-sm',
              current ? 'text-fg' : 'text-fg-subtle',
            )}
          >
            {current?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="size-4 text-fg-subtle" aria-hidden="true" />
        </ListboxButton>
        <ListboxOptions
          anchor={{ to: 'bottom start', gap: 6 }}
          transition
          className={cn(menuSurfaceClasses, 'max-h-72 w-(--button-width) overflow-auto')}
        >
          {allowEmpty && (
            <ListboxOption value={null} className={cn(menuItemClasses, 'text-fg-muted')}>
              <span className="flex-1">{placeholder}</span>
            </ListboxOption>
          )}
          {options.map((option) => (
            <ListboxOption key={option.value} value={option.value} className={menuItemClasses}>
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <Check
                className="invisible size-4 text-brand group-data-selected:visible"
                aria-hidden="true"
              />
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
      {hint && !error && <FieldHint>{hint}</FieldHint>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
