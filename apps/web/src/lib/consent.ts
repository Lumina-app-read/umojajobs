/**
 * Consentement aux cookies. Le choix est enregistré dans un cookie propre au site (lui-même
 * strictement nécessaire : il mémorise le choix) avec sa date, les catégories acceptées et la
 * version de la politique. Une nouvelle version de la politique redemande le consentement.
 *
 * Les cookies strictement nécessaires (session, protection CSRF, langue et thème choisis) ne
 * dépendent pas de ce choix. Tout autre cookie ou script se place derrière une catégorie.
 */

/** Version de la politique des cookies : la changer redemande le consentement à tous. */
export const COOKIE_POLICY_VERSION = '2026-11-25';
export const CONSENT_COOKIE = 'umoja_consent';
/** Durée de validité du choix (acceptation comme refus) : 6 mois, puis nouvelle demande. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 182;

/**
 * Catégories soumises au consentement. Aucun outil marketing n'est utilisé : la catégorie
 * s'ajoutera ici, avec ses textes, le jour où un tel outil sera intégré.
 */
export const CONSENT_CATEGORIES = ['functional', 'analytics'] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

export interface ConsentRecord {
  version: string;
  /** Date du choix (ISO 8601). */
  decidedAt: string;
  categories: Record<ConsentCategory, boolean>;
}

export const allCategories = (granted: boolean): Record<ConsentCategory, boolean> =>
  Object.fromEntries(CONSENT_CATEGORIES.map((category) => [category, granted])) as Record<
    ConsentCategory,
    boolean
  >;

export function serializeConsent(record: ConsentRecord): string {
  const accepted = CONSENT_CATEGORIES.filter((category) => record.categories[category]);
  return encodeURIComponent(
    JSON.stringify({ v: record.version, d: record.decidedAt, c: accepted }),
  );
}

/** Lit le choix enregistré ; null s'il est absent, illisible ou d'une ancienne version. */
export function parseConsent(raw: string | undefined | null): ConsentRecord | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as { v?: unknown; d?: unknown; c?: unknown };
    if (data.v !== COOKIE_POLICY_VERSION) return null;
    if (typeof data.d !== 'string' || Number.isNaN(Date.parse(data.d))) return null;
    if (!Array.isArray(data.c)) return null;
    const accepted = new Set(data.c);
    return {
      version: data.v,
      decidedAt: data.d,
      categories: Object.fromEntries(
        CONSENT_CATEGORIES.map((category) => [category, accepted.has(category)]),
      ) as Record<ConsentCategory, boolean>,
    };
  } catch {
    return null;
  }
}

export function readConsentCookie(cookieHeader: string): ConsentRecord | null {
  const match = new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]+)`).exec(cookieHeader);
  return parseConsent(match?.[1]);
}

/** Le consentement couvre-t-il cette catégorie ? Sans choix enregistré : non. */
export const hasConsent = (record: ConsentRecord | null, category: ConsentCategory): boolean =>
  record?.categories[category] === true;

// --- Navigateur : lecture abonnée (useSyncExternalStore) et enregistrement -----------------------

const listeners = new Set<() => void>();
let cachedHeader: string | null = null;
let cachedRecord: ConsentRecord | null = null;

export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Instantané stable tant que le cookie ne change pas (exigence de useSyncExternalStore). */
export function getConsentSnapshot(): ConsentRecord | null {
  const header = document.cookie;
  if (header !== cachedHeader) {
    cachedHeader = header;
    cachedRecord = readConsentCookie(header);
  }
  return cachedRecord;
}

/** Cookies déposés par une catégorie : effacés lorsque celle-ci est refusée ou retirée. */
const CATEGORY_COOKIES: Record<ConsentCategory, readonly string[]> = {
  functional: ['umoja_job_countries'],
  analytics: [],
};

function secureAttribute(): string {
  return window.location.protocol === 'https:' ? '; Secure' : '';
}

export function saveConsent(categories: Record<ConsentCategory, boolean>): ConsentRecord {
  const record: ConsentRecord = {
    version: COOKIE_POLICY_VERSION,
    decidedAt: new Date().toISOString(),
    categories,
  };
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(record)}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secureAttribute()}`;
  for (const category of CONSENT_CATEGORIES) {
    if (categories[category]) continue;
    for (const name of CATEGORY_COOKIES[category]) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secureAttribute()}`;
    }
  }
  listeners.forEach((listener) => listener());
  return record;
}

/**
 * Dépose un cookie d'une catégorie soumise au consentement, uniquement si elle est acceptée.
 * Renvoie false (et ne dépose rien) sinon.
 */
export function setConsentedCookie(
  category: ConsentCategory,
  name: string,
  value: string,
  maxAgeSeconds: number,
): boolean {
  if (!hasConsent(getConsentSnapshot(), category)) return false;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secureAttribute()}`;
  return true;
}

/** Événement qui rouvre le panneau des préférences (lien du pied de page, paramètres). */
export const OPEN_COOKIE_PREFERENCES_EVENT = 'umoja:cookie-preferences';

export function openCookiePreferences(): void {
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT));
}
