import { randomBytes } from 'node:crypto';

/**
 * Génère un UUID version 7 (RFC 9562) : 48 bits d'horodatage en millisecondes, puis de l'aléa.
 * Les identifiants sont triables dans l'ordre de création, ce qui favorise les index B-tree.
 *
 * Prisma génère ces identifiants pour les écritures classiques (`@default(uuid(7))`) ; cette
 * fonction sert aux insertions SQL en masse (seed), où Prisma n'intervient pas.
 */
export function uuidv7(timestampMs: number = Date.now()): string {
  const bytes = randomBytes(16);
  let timestamp = BigInt(timestampMs);

  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variante RFC 9562

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
