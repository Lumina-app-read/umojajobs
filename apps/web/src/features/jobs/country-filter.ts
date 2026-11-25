/**
 * Pays des offres affichées. Dans l'adresse : ?country=CD&country=SN (sélection) ou
 * ?country=all (tous les pays, choisi explicitement). Sans paramètre, l'espace connecté applique
 * la préférence de recherche mémorisée (cookie fonctionnel, avec consentement), sinon le pays du
 * profil. Le pays du profil n'est jamais modifié par ces filtres.
 */

export const ALL_COUNTRIES = 'all';
/** Préférence de recherche (catégorie « fonctionnels » du consentement aux cookies). */
export const JOB_COUNTRIES_COOKIE = 'umoja_job_countries';
export const JOB_COUNTRIES_MAX_AGE_SECONDS = 60 * 60 * 24 * 182;
/** Au plus 54 pays africains. */
const MAX_COUNTRIES = 54;
const ISO2 = /^[A-Z]{2}$/;

export type CountryScope = 'mine' | 'all' | 'custom';

export interface CountrySelection {
  /** Le choix vient-il de l'adresse ou d'une préférence (et non du défaut) ? */
  explicit: boolean;
  /** Pays retenus ; vide = tous les pays. */
  countries: string[];
}

function cleanList(values: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const code = value.trim().toUpperCase();
    if (ISO2.test(code)) unique.add(code);
    if (unique.size >= MAX_COUNTRIES) break;
  }
  return [...unique];
}

/** Lit le paramètre « country » de l'adresse (unique, répété ou « all »). */
export function parseCountryParam(value: string | string[] | undefined): CountrySelection | null {
  if (value === undefined) return null;
  const values = (Array.isArray(value) ? value : [value]).flatMap((item) => item.split(','));
  if (values.some((item) => item.trim().toLowerCase() === ALL_COUNTRIES)) {
    return { explicit: true, countries: [] };
  }
  const countries = cleanList(values);
  return countries.length > 0 ? { explicit: true, countries } : null;
}

/** Lit la préférence mémorisée (« all » ou « CD,SN ») ; null si absente ou illisible. */
export function parseCountryPreference(raw: string | undefined): CountrySelection | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return parseCountryParam(decoded);
}

export const serializeCountryPreference = (countries: readonly string[]): string =>
  countries.length === 0 ? ALL_COUNTRIES : cleanList(countries).join(',');

/**
 * Pays à appliquer : l'adresse d'abord, puis (espace connecté seulement) la préférence mémorisée,
 * puis le pays du profil. Le site public affiche tous les pays par défaut.
 */
export function resolveCountries({
  param,
  preference,
  homeCountry,
}: {
  param: string | string[] | undefined;
  preference?: string;
  homeCountry?: string | null;
}): CountrySelection {
  const fromUrl = parseCountryParam(param);
  if (fromUrl) return fromUrl;
  if (homeCountry === undefined) return { explicit: false, countries: [] };
  const remembered = parseCountryPreference(preference);
  if (remembered) return remembered;
  return { explicit: false, countries: homeCountry ? [homeCountry] : [] };
}

/** Mode affiché par le sélecteur : mon pays, tous les pays ou une sélection. */
export function countryScope(
  countries: readonly string[],
  homeCountry?: string | null,
): CountryScope {
  if (countries.length === 0) return 'all';
  if (homeCountry && countries.length === 1 && countries[0] === homeCountry) return 'mine';
  return 'custom';
}

/** Valeur du paramètre d'adresse pour une sélection (« all » quand elle est vide). */
export const countryQuery = (countries: readonly string[]): string[] =>
  countries.length === 0 ? [ALL_COUNTRIES] : [...countries];
