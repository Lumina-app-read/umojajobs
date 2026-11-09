import enEmails from './locales/en/emails.json';
import frEmails from './locales/fr/emails.json';
import { type MessageParams, type MessageTree, translate } from './translate';

export { listKeys, translate, type MessageParams, type MessageTree } from './translate';

/** Langues disponibles. Doit rester aligné avec SUPPORTED_LOCALES de @opportinities/shared. */
export const I18N_LOCALES = ['fr', 'en'] as const;
export type I18nLocale = (typeof I18N_LOCALES)[number];

/**
 * Catalogues par langue et par espace de noms. Les espaces « ui », « errors » et
 * « notifications » seront ajoutés en phase 1d (interface Next.js via next-intl).
 */
export const CATALOGS = {
  fr: { emails: frEmails },
  en: { emails: enEmails },
} as const satisfies Record<I18nLocale, Record<string, MessageTree>>;

export type Namespace = keyof (typeof CATALOGS)['fr'];

/** Traducteur lié à une langue et un espace de noms. */
export function getTranslator(
  locale: I18nLocale,
  namespace: Namespace,
): (key: string, params?: MessageParams) => string {
  const messages: MessageTree = CATALOGS[locale][namespace];
  return (key, params) => translate(messages, key, params);
}
