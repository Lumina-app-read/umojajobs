import { APP_NAME } from '@opportinities/shared';
import { routing } from '@/i18n/routing';

/** Adresse publique du site (production : variable d'environnement SITE_URL). */
export const SITE_URL = (
  process.env.SITE_URL ??
  process.env.APP_URL ??
  'http://localhost:3000'
).replace(/\/+$/, '');

/**
 * Adresse canonique et versions linguistiques d'une page (chemin sans langue, ex. « /jobs »).
 * La version française sert aussi de version par défaut.
 */
export function localizedAlternates(locale: string, path: string) {
  const suffix = path === '/' ? '' : path;
  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((entry) => [entry, `/${entry}${suffix}`])),
      'x-default': `/${routing.defaultLocale}${suffix}`,
    },
  };
}

/** JSON sûr dans une balise script : « < » échappé, la balise ne peut pas être refermée. */
export const jsonLd = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c');

/**
 * Métadonnées d'une page publique : adresse canonique, versions linguistiques et aperçu de partage
 * (réseaux sociaux, messageries) avec le titre et la description de la page.
 */
export function publicPageMetadata(input: {
  locale: string;
  path: string;
  title: string;
  description: string;
  type?: 'website' | 'article';
}) {
  return {
    title: input.title,
    description: input.description,
    alternates: localizedAlternates(input.locale, input.path),
    openGraph: {
      type: input.type ?? 'website',
      siteName: APP_NAME,
      title: input.title,
      description: input.description,
      url: `/${input.locale}${input.path === '/' ? '' : input.path}`,
      locale: input.locale === 'en' ? 'en_US' : 'fr_FR',
      images: [{ url: '/images/logos/logo-white.png', width: 3264, height: 1836, alt: APP_NAME }],
    },
  };
}
