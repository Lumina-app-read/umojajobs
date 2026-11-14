import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Bloc de chargement à la forme du contenu final. Reflet discret, désactivé si les animations sont réduites. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--surface-2)_0%,color-mix(in_srgb,var(--surface-2)_40%,var(--surface))_50%,var(--surface-2)_100%)] bg-size-[200%_100%]',
        className,
      )}
    />
  );
}

/** État vide utile : une icône, une phrase qui explique, une action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid justify-items-center gap-2.5 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center',
        className,
      )}
    >
      <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-brand">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      {description && (
        <p className="max-w-[38ch] text-sm sm:text-[13px] text-fg-muted">{description}</p>
      )}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

/** Indicateur clé : libellé, valeur en chiffres alignés, contexte. Quatre au maximum par écran. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: { value: string; positive: boolean };
  className?: string;
}) {
  return (
    <div
      className={cn(
        'lift grid gap-1.5 rounded-xl border border-line bg-surface p-4 shadow-xs',
        className,
      )}
    >
      <p className="flex items-center gap-2 text-sm sm:text-[13px] text-fg-muted">
        {Icon && <Icon className="size-4 text-fg-subtle" aria-hidden="true" />}
        {label}
      </p>
      <p className="text-[26px] leading-8 font-bold tracking-[-0.02em] text-fg tabular-nums">
        {value}
      </p>
      {(hint ?? trend) && (
        <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
          {trend && (
            <span className={cn('font-semibold', trend.positive ? 'text-success' : 'text-danger')}>
              {trend.value}
            </span>
          )}
          {hint}
        </p>
      )}
    </div>
  );
}

/** Avatar à initiales (aucune photo exigée). */
export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const sizes = {
    sm: 'size-7 text-xs sm:text-[11px]',
    md: 'size-8 text-xs',
    lg: 'size-10 text-sm',
  };
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-brand',
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
