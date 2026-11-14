'use client';

import { Check, CircleAlert, Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { type InputHTMLAttributes, type ReactNode, useId, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Cadre commun des champs (44 px sur mobile, 40 px au-delà) : utilisé par les champs texte, mot de passe et combobox.
 * Texte en 16 px sur mobile (évite le zoom automatique d'iOS), 14 px à partir de 640 px.
 */
export function controlFrameClasses(invalid: boolean, disabled = false): string {
  return cn(
    'relative flex h-11 w-full sm:h-10 items-center rounded-md border bg-surface shadow-xs',
    'transition-[border-color,box-shadow] duration-[120ms]',
    'focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring',
    invalid
      ? 'border-danger focus-within:border-danger focus-within:ring-danger/20'
      : 'border-line-strong hover:border-fg-subtle/50',
    disabled && 'cursor-not-allowed bg-surface-2 opacity-70',
  );
}

export const controlInputClasses =
  'h-full min-w-0 flex-1 bg-transparent px-3 text-base text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed sm:text-sm';

/** Classes d'un champ sans cadre séparé (compatibilité). */
export const inputClasses = (invalid: boolean) =>
  cn(controlFrameClasses(invalid), controlInputClasses, 'focus:outline-none');

export function FieldLabel({
  htmlFor,
  children,
  optional,
}: {
  htmlFor?: string;
  children: ReactNode;
  optional?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm sm:text-[13px] font-semibold text-fg">
      {children}
      {optional && <span className="ml-1 font-normal text-fg-subtle">{optional}</span>}
    </label>
  );
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-[13px] text-fg-subtle sm:text-xs">
      {children}
    </p>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-[13px] font-medium text-danger sm:text-xs">
      <CircleAlert className="size-3.5" aria-hidden="true" />
      {children}
    </p>
  );
}

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'size'> {
  label: string;
  name: string;
  error?: string | null;
  hint?: ReactNode;
  /**
   * Règle du design system : chaque champ a une icône Lucide à gauche (Mail, Lock, User…) et un
   * exemple de saisie en placeholder. Les deux sont obligatoires dans le typage.
   */
  icon: LucideIcon;
  placeholder: string;
  /** Élément à droite (bouton d'action, unité). */
  trailing?: ReactNode;
  /** Affiche une coche discrète lorsque la valeur est validée. */
  valid?: boolean;
  /** Mention affichée après le libellé, par exemple « (facultatif) ». */
  optionalLabel?: string;
}

/** Champ accessible : libellé visible, aide et erreur reliées par aria-describedby, cinq états. */
export function FormField({
  label,
  name,
  error,
  hint,
  icon: Icon,
  trailing,
  valid,
  optionalLabel,
  className,
  disabled,
  'aria-describedby': extraDescription,
  ...props
}: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn('grid min-w-0 gap-1.5', className)}>
      <FieldLabel htmlFor={id} optional={optionalLabel}>
        {label}
      </FieldLabel>
      <div className={controlFrameClasses(Boolean(error), disabled)}>
        <Icon className="ml-3 size-[18px] shrink-0 text-fg-subtle sm:size-4" aria-hidden="true" />
        <input
          id={id}
          name={name}
          disabled={disabled}
          className={cn(controlInputClasses, 'pl-2')}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [hintId, errorId, extraDescription].filter(Boolean).join(' ') || undefined
          }
          {...props}
        />
        {valid && !error && <Check className="mr-3 size-4 text-success" aria-hidden="true" />}
        {trailing && <div className="mr-1 flex items-center">{trailing}</div>}
      </div>
      {hint && !error && <FieldHint id={hintId}>{hint}</FieldHint>}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

interface PasswordFieldProps extends Omit<FormFieldProps, 'type' | 'trailing'> {
  showLabel: string;
  hideLabel: string;
}

/** Champ mot de passe avec bouton afficher / masquer. */
export function PasswordField({ showLabel, hideLabel, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;
  return (
    <FormField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="flex size-8 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
        >
          <ToggleIcon className="size-[18px] sm:size-4" aria-hidden="true" />
        </button>
      }
    />
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label: ReactNode;
  error?: string | null;
}

/** Case à cocher native (accessible par défaut), habillée aux couleurs du système. */
export function Checkbox({ label, error, className, ...props }: CheckboxProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('grid min-w-0 gap-1.5', className)}>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-2.5 text-sm sm:text-[13px] leading-5 text-fg-muted"
      >
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong accent-primary"
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          {...props}
        />
        <span>{label}</span>
      </label>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
