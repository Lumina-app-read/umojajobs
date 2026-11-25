import { afterEach, describe, expect, it } from 'vitest';
import {
  allCategories,
  CONSENT_COOKIE,
  COOKIE_POLICY_VERSION,
  getConsentSnapshot,
  hasConsent,
  parseConsent,
  readConsentCookie,
  saveConsent,
  serializeConsent,
  setConsentedCookie,
} from './consent';

function clearCookies() {
  for (const entry of document.cookie.split('; ')) {
    const name = entry.split('=')[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

describe('consentement aux cookies', () => {
  afterEach(clearCookies);

  it('enregistre la date, les catégories acceptées et la version de la politique', () => {
    const record = {
      version: COOKIE_POLICY_VERSION,
      decidedAt: '2026-11-25T10:00:00.000Z',
      categories: { functional: true, analytics: false },
    };
    expect(parseConsent(serializeConsent(record))).toEqual(record);
  });

  it('redemande le consentement après un changement de politique ou si le cookie est illisible', () => {
    const old = encodeURIComponent(JSON.stringify({ v: '2020-01-01', d: '2020-01-01', c: [] }));
    expect(parseConsent(old)).toBeNull();
    expect(parseConsent('pas-du-json')).toBeNull();
    expect(parseConsent(undefined)).toBeNull();
  });

  it('sans choix enregistré, aucune catégorie non essentielle n’est acceptée', () => {
    expect(hasConsent(null, 'analytics')).toBe(false);
    expect(hasConsent(readConsentCookie(''), 'functional')).toBe(false);
  });

  it('« Tout refuser » retire les cookies des catégories refusées', () => {
    saveConsent(allCategories(true));
    expect(setConsentedCookie('functional', 'umoja_job_countries', 'CD,SN', 60)).toBe(true);
    expect(document.cookie).toContain('umoja_job_countries=CD%2CSN');

    saveConsent(allCategories(false));
    expect(document.cookie).not.toContain('umoja_job_countries');
    expect(document.cookie).toContain(`${CONSENT_COOKIE}=`);
    expect(getConsentSnapshot()?.categories).toEqual({ functional: false, analytics: false });
    expect(setConsentedCookie('functional', 'umoja_job_countries', 'CD', 60)).toBe(false);
    expect(document.cookie).not.toContain('umoja_job_countries');
  });
});
