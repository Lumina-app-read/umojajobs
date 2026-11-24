/** Clés dont la valeur n'est jamais journalisée (secrets, codes, coordonnées de versement). */
const SECRET_KEY =
  /pass(word)?|secret|token|code|otp|totp|account|iban|swift|bic|card|phone|cookie/i;
const MAX_DEPTH = 4;
const MAX_STRING = 500;
const MAX_ITEMS = 50;

/** Copie journalisable d'une valeur reçue : secrets masqués, taille bornée. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[…]';
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ITEMS).map((item) => redact(item, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, MAX_ITEMS)
      .map(([key, entry]) => [key, SECRET_KEY.test(key) ? '[masqué]' : redact(entry, depth + 1)]),
  );
}
