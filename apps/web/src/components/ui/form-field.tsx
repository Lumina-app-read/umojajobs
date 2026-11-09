'use client';

import { Eye, EyeOff } from 'lucide-react';
import { type InputHTMLAttributes, type ReactNode, useId, useState } from 'react';
import { cn } from '@/lib/cn';

export const inputClasses = (invalid: boolean) =>
  cn(
    'block h-11 w-full rounded-md border bg-surface px-3 text-base text-foreground shadow-xs',
    'placeholder:text-muted focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30',
    invalid ? 'border-danger' : 'border-border-strong',
  );

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  name: string;
  error?: string | null;
  hint?: ReactNode;
}

/** Champ de formulaire accessible : libellé associé, aide et erreur reliées par aria-describedby. */
export function FormField({ label, name, error, hint, className, ...props }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className={inputClasses(Boolean(error))}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface PasswordFieldProps extends Omit<FormFieldProps, 'type'> {
  showLabel: string;
  hideLabel: string;
}

/** Champ mot de passe avec bouton afficher / masquer. */
export function PasswordField({
  label,
  name,
  error,
  hint,
  showLabel,
  hideLabel,
  className,
  ...props
}: PasswordFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          className={cn(inputClasses(Boolean(error)), 'pr-11')}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted hover:text-foreground"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-5" aria-hidden="true" />
          ) : (
            <Eye className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
