import type { JobOfferStatus } from '@opportinities/shared';

/** Une offre « expire bientôt » lorsqu'il lui reste moins de ce nombre de jours. */
export const EXPIRING_SOON_DAYS = 3;

const DAY_MS = 86_400_000;

export type JobTiming =
  { state: 'open' } | { state: 'closing'; daysLeft: number } | { state: 'expired' };

/**
 * État de validité affiché sur une offre : en cours (vert), proche de l'expiration (orange)
 * ou expirée (rouge). Le statut de l'API fait foi pour l'expiration ; l'échéance `endsAt`
 * (instant exact de fin) sert au décompte, et une échéance dépassée vaut expiration même si
 * le traitement planifié n'est pas encore passé.
 */
export function jobTiming(status: JobOfferStatus, endsAt: string, now: Date): JobTiming {
  const remaining = new Date(endsAt).getTime() - now.getTime();
  if (status === 'expired' || remaining <= 0) return { state: 'expired' };
  // Jours entamés restants : 0 = dernier jour (moins de 24 h).
  const daysLeft = Math.floor(remaining / DAY_MS);
  return daysLeft < EXPIRING_SOON_DAYS ? { state: 'closing', daysLeft } : { state: 'open' };
}
