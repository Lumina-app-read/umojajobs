import { describe, expect, it } from 'vitest';
import {
  searchTranslations,
  summarize,
  type TranslationRow,
  translationRows,
} from './translation-index';

const ROWS: TranslationRow[] = [
  { namespace: 'common', key: 'nav.home', fr: 'Accueil', en: 'Home' },
  { namespace: 'errors', key: 'LOGIN_FAILED', fr: 'Échec de connexion', en: 'Sign-in failed' },
  { namespace: 'errors', key: 'NEW_ONE', fr: 'Nouveau', en: null },
];

describe('index des traductions', () => {
  it('couvre tous les espaces et ne signale aucun texte manquant dans le dépôt', () => {
    const summaries = summarize(translationRows());
    expect(summaries.map((summary) => summary.namespace)).toContain('emails');
    expect(summaries.every((summary) => summary.keys > 0)).toBe(true);
    expect(summaries.filter((summary) => summary.missingFr + summary.missingEn > 0)).toEqual([]);
  });

  it('compte les clés et les textes manquants par espace', () => {
    expect(summarize(ROWS)).toEqual([
      { namespace: 'common', keys: 1, missingFr: 0, missingEn: 0 },
      { namespace: 'errors', keys: 2, missingFr: 0, missingEn: 1 },
    ]);
  });

  it('cherche sans tenir compte des accents ni de la casse, dans la clé et les deux langues', () => {
    expect(searchTranslations(ROWS, { q: 'echec' }).map((row) => row.key)).toEqual([
      'LOGIN_FAILED',
    ]);
    expect(searchTranslations(ROWS, { q: 'HOME' }).map((row) => row.key)).toEqual(['nav.home']);
    expect(searchTranslations(ROWS, { q: 'errors.new' }).map((row) => row.key)).toEqual([
      'NEW_ONE',
    ]);
  });

  it('filtre par espace et par textes manquants', () => {
    expect(searchTranslations(ROWS, { namespace: 'errors' })).toHaveLength(2);
    expect(searchTranslations(ROWS, { missing: true }).map((row) => row.key)).toEqual(['NEW_ONE']);
    expect(searchTranslations(ROWS, { q: 'accueil', namespace: 'errors' })).toEqual([]);
  });
});
