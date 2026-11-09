import { createHmac, randomBytes } from 'node:crypto';
import { safeEqual } from '../../common/crypto/tokens';
import { base32Decode, base32Encode } from './base32';

/** Paramètres standard (RFC 6238), compatibles avec toutes les applications d'authentification. */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Tolérance de décalage d'horloge : un pas avant ou après. */
export const TOTP_WINDOW = 1;

/** Secret de 160 bits (recommandation RFC 4226), encodé en Base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function timeStep(timestampMs: number = Date.now()): number {
  return Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS);
}

/** Code HOTP (RFC 4226) pour un compteur donné. */
export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary =
    (((digest[offset] ?? 0) & 0x7f) << 24) |
    ((digest[offset + 1] ?? 0) << 16) |
    ((digest[offset + 2] ?? 0) << 8) |
    (digest[offset + 3] ?? 0);
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export function totp(secretBase32: string, timestampMs: number = Date.now()): string {
  return hotp(base32Decode(secretBase32), timeStep(timestampMs));
}

/**
 * Vérifie un code dans la fenêtre de tolérance et renvoie le pas de temps correspondant,
 * ou null. L'appelant doit refuser un pas déjà utilisé (anti-rejeu).
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  timestampMs: number = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const current = timeStep(timestampMs);
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const step = current + offset;
    if (safeEqual(hotp(secret, step), code)) {
      return step;
    }
  }
  return null;
}

/** URI otpauth:// à afficher sous forme de QR code dans l'interface. */
export function totpUri(secretBase32: string, accountName: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
