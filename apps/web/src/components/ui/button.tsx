import { type LucideIcon } from 'lucide-react';
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-fg shadow-xs hover:bg-primary-hover hover:shadow-sm inset-shadow-[0_1px_0_rgb(255_255_255/0.12)]',
  secondary: 'border border-line-strong bg-surface text-fg shadow-xs hover:bg-surface-2',
  ghost: 'text-fg-muted hover:bg-surface-2 hover:text-fg',
  danger: 'bg-danger-solid text-white shadow-xs hover:brightness-110',
  link: 'h-auto! px-0! text-brand underline-offset-4 hover:underline',
};

/** Hauteurs : 32 (filtres), 36 (défaut des tableaux de bord), 40 (formulaires), 48 (hero uniquement). */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-[13px]',
  md: 'h-9 gap-2 px-3.5 text-sm',
  lg: 'h-10 gap-2 px-4 text-sm',
  xl: 'h-12 gap-2 px-5 text-[15px]',
};

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-10',
  xl: 'size-12',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = false,
): string {
  return cn(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-semibold tracking-[-0.005em]',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-[120ms] ease-out active:translate-y-px',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
  );
}

/**
 * Règle du design system : tout bouton porte une icône Lucide, avant le libellé (`icon`) ou après
 * (`trailingIcon`, pour une flèche « Continuer »). Le typage l'impose : un bouton sans icône ne
 * compile pas.
 */
export type ButtonIcons =
  { icon: LucideIcon; trailingIcon?: LucideIcon } | { icon?: undefined; trailingIcon: LucideIcon };

interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Action en cours : indicateur visible, bouton désactivé, libellé conservé (pas de saut de largeur). */
  loading?: boolean;
  /** Libellé annoncé pendant le chargement (lecteurs d'écran). */
  loadingLabel?: string;
}

export type ButtonProps = BaseButtonProps & ButtonIcons;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth,
    icon: Icon,
    trailingIcon: TrailingIcon,
    loading = false,
    loadingLabel,
    className,
    children,
    disabled,
    type,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(buttonClasses(variant, size, fullWidth), className)}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : Icon && <Icon className="size-4" aria-hidden="true" />}
      {loading && loadingLabel ? <span>{loadingLabel}</span> : children}
      {!loading && TrailingIcon && <TrailingIcon className="size-4" aria-hidden="true" />}
    </button>
  );
});

export interface IconButtonProps extends Omit<
  BaseButtonProps,
  'children' | 'loadingLabel' | 'fullWidth'
> {
  icon: LucideIcon;
  /** Libellé accessible obligatoire (aucun texte visible). */
  label: string;
  children?: ReactNode;
}

/** Bouton carré à icône seule, avec libellé accessible et info-bulle native. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon: Icon,
    label,
    variant = 'ghost',
    size = 'md',
    className,
    children,
    type,
    loading = false,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      {...props}
      className={cn(buttonClasses(variant, size), ICON_SIZES[size], 'px-0', className)}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
      {children}
    </button>
  );
});
