/** Limites de durée d'une session (millisecondes). */
export interface SessionLimits {
  /** Durée maximale depuis l'ouverture de la session. */
  maxAgeMs: number;
  /** Inactivité maximale depuis la dernière requête. */
  idleMs: number;
}

export interface SessionTimes {
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

/**
 * Une session est-elle encore utilisable à l'instant `now` ?
 * La date d'expiration fixée à l'ouverture s'applique toujours. Pour un compte disposant de
 * l'accès à l'administration, les limites plus courtes (`privileged`) s'ajoutent : elles prennent
 * effet immédiatement si un rôle est attribué pendant la session.
 */
export function isSessionUsable(
  session: SessionTimes,
  now: number,
  standard: SessionLimits,
  privileged: SessionLimits | null,
): boolean {
  if (session.expiresAt.getTime() <= now) return false;
  const limits = privileged ?? standard;
  if (session.createdAt.getTime() + limits.maxAgeMs <= now) return false;
  return session.lastSeenAt.getTime() + limits.idleMs > now;
}
