import 'server-only';
import { getTranslations } from 'next-intl/server';
import { type CvLabels } from './cv-format';
import { type StudioLabels } from './document-view';
import { type LetterLabels } from './letters/letter-format';

/**
 * Libellés imprimés sur les documents (CV et lettres), dans la langue du document et non dans
 * celle de l'interface.
 */
export async function studioLabels(language: 'fr' | 'en'): Promise<StudioLabels> {
  const t = await getTranslations({ locale: language, namespace: 'studio' });
  // Sous-arbres complets : `raw` attend une feuille dans le typage de next-intl.
  const raw = t.raw as (key: string) => unknown;
  return { cv: raw('cv') as CvLabels, letter: raw('letterPrint') as LetterLabels };
}
