import { toSearchName } from '../locations/search-name';

const MAX_LENGTH = 72;

/** Identifiant d'adresse tiré du nom anglais ; un suffixe le distingue s'il est déjà pris. */
export function categorySlug(nameEn: string, taken: ReadonlySet<string>): string {
  const base =
    toSearchName(nameEn)
      .replace(/\s+/g, '-')
      .slice(0, MAX_LENGTH)
      .replace(/^-+|-+$/g, '') || 'category';
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}
