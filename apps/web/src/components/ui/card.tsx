import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Carte : surface, bordure fine, rayon 12 px, ombre très légère (reflet en mode sombre).
 * À réserver aux objets à isoler : un écran n'est pas un empilement de cartes.
 */
export function Card({
  children,
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface shadow-xs',
        interactive &&
          'transition-[border-color,box-shadow] duration-[120ms] hover:border-line-strong hover:shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 border-b border-line px-4 py-3.5',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Mise en page provisoire des écrans d'authentification (refonte prévue à l'étape D3). */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[440px] px-4 py-10 sm:py-16">
      <Card className="p-6 sm:p-7">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </Card>
      {footer && <div className="mt-5 text-center text-[13px] text-fg-muted">{footer}</div>}
    </div>
  );
}
