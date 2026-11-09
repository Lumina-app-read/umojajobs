import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'accent';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-fg-muted',
  primary: 'bg-primary-soft text-brand',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent-soft text-accent',
};

/** Pilule de statut (offres, commissions, retraits). Le point renforce l'état sans dépendre de la couleur seule. */
export function Badge({
  tone = 'neutral',
  dot = false,
  icon: Icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {Icon && <Icon className="size-3" aria-hidden="true" />}
      {children}
    </span>
  );
}
