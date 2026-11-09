import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Jeton aléatoire sûr (256 bits par défaut), encodé en base64url pour les URLs et cookies. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Empreinte SHA-256 (hexadécimal) d'un jeton à forte entropie. Seule l'empreinte est stockée :
 * une fuite de la base ne permet pas de réutiliser les sessions ou les liens envoyés par email.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Comparaison en temps constant de deux chaînes (évite les attaques temporelles). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}
