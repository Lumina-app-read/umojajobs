import 'server-only';
import { getTranslations } from 'next-intl/server';
import { type CvLabels } from './cv-format';

/** Libellés imprimés sur un CV, dans la langue du document (et non celle de l'interface). */
export async function cvLabels(language: 'fr' | 'en'): Promise<CvLabels> {
  const t = await getTranslations({ locale: language, namespace: 'studio' });
  // Sous-arbre complet (libellés et mois) : `raw` attend une feuille dans le typage de next-intl.
  return (t.raw as (key: string) => unknown)('cv') as CvLabels;
}
