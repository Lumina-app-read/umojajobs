import type { JobOfferStatus } from '@opportinities/shared';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { jobTiming } from './timing';

const DOT = {
  open: 'bg-success',
  closing: 'bg-warning',
  expired: 'bg-danger',
} as const;

const TEXT = {
  open: 'text-success',
  closing: 'text-warning',
  expired: 'text-danger',
} as const;

/**
 * Pastille de validité : verte (en cours), orange (expire bientôt), rouge (expirée).
 * La couleur n'est jamais seule porteuse du sens : un libellé l'accompagne toujours.
 */
export function TimingIndicator({
  status,
  endsAt,
  endDate,
  pulse = false,
  className,
}: {
  status: JobOfferStatus;
  endsAt: string;
  /** Dernier jour de validité (AAAA-MM-JJ), affiché dans l'info-bulle. */
  endDate: string;
  /** Halo animé sur la pastille verte (fiche d'offre) ; désactivé dans les listes. */
  pulse?: boolean;
  className?: string;
}) {
  const t = useTranslations('jobs.public.timing');
  const format = useFormatter();
  // Instant du rendu : la page est rendue à chaque requête, la précision suffit.
  const now = useNow();
  const timing = jobTiming(status, endsAt, now);
  const end = format.dateTime(new Date(`${endDate}T12:00:00Z`), { dateStyle: 'medium' });

  const label =
    timing.state === 'open'
      ? t('open')
      : timing.state === 'closing'
        ? timing.daysLeft === 0
          ? t('closingToday')
          : t('closing', { count: timing.daysLeft })
        : t('expired');

  return (
    <span
      className={cn('inline-flex items-center gap-2 text-[13px] font-medium', className)}
      title={timing.state === 'expired' ? t('endedOn', { date: end }) : t('endsOn', { date: end })}
    >
      <span className="relative flex size-2.5" aria-hidden="true">
        {pulse && timing.state === 'open' && (
          <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
        )}
        <span className={cn('relative inline-flex size-2.5 rounded-full', DOT[timing.state])} />
      </span>
      <span className={TEXT[timing.state]}>{label}</span>
    </span>
  );
}
