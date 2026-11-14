import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'error' | 'success' | 'info' | 'warning';

const TONES: Record<Tone, { box: string; icon: string }> = {
  error: { box: 'border-danger/30 bg-danger-soft', icon: 'text-danger' },
  success: { box: 'border-success/30 bg-success-soft', icon: 'text-success' },
  warning: { box: 'border-warning/30 bg-warning-soft', icon: 'text-warning' },
  info: { box: 'border-brand/25 bg-primary-soft', icon: 'text-brand' },
};

const ICONS = { error: CircleAlert, success: CircleCheck, warning: TriangleAlert, info: Info };

/** Message d'état : role="alert" pour les erreurs (annoncées immédiatement), "status" sinon. */
export function Alert({
  tone,
  title,
  children,
  action,
  className,
}: {
  tone: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-lg border px-3.5 py-3 text-sm sm:text-[13px] leading-5 text-fg',
        TONES[tone].box,
        className,
      )}
    >
      <Icon className={cn('mt-0.5 size-4', TONES[tone].icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-fg-muted [&_strong]:text-fg">{children}</div>}
        {action && <div className="pt-1.5">{action}</div>}
      </div>
    </div>
  );
}
