import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'error' | 'success' | 'info';

const TONES: Record<Tone, string> = {
  error: 'border-danger-border bg-danger-surface text-danger',
  success: 'border-success-border bg-success-surface text-success',
  info: 'border-info-border bg-info-surface text-foreground',
};

const ICONS = { error: CircleAlert, success: CircleCheck, info: Info };

/** Message d'état annoncé aux lecteurs d'écran (role="alert" pour les erreurs, "status" sinon). */
export function Alert({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-md border px-4 py-3 text-sm', TONES[tone], className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}
