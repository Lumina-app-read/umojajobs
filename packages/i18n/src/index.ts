import enAuth from './locales/en/auth.json';
import enCommon from './locales/en/common.json';
import enEmails from './locales/en/emails.json';
import enErrors from './locales/en/errors.json';
import enLanding from './locales/en/landing.json';
import enValidation from './locales/en/validation.json';
import frAuth from './locales/fr/auth.json';
import frCommon from './locales/fr/common.json';
import frEmails from './locales/fr/emails.json';
import frErrors from './locales/fr/errors.json';
import frLanding from './locales/fr/landing.json';
import frValidation from './locales/fr/validation.json';
import { type MessageParams, type MessageTree, translate } from './translate';

export { listKeys, translate, type MessageParams, type MessageTree } from './translate';

/** Langues disponibles. Doit rester aligné avec SUPPORTED_LOCALES de @opportinities/shared. */
export const I18N_LOCALES = ['fr', 'en'] as const;
export type I18nLocale = (typeof I18N_LOCALES)[number];

/**
 * Catalogues par langue et par espace de noms :
 * - interface web (next-intl) : common, auth, errors, validation, landing ;
 * - emails transactionnels (API) : emails.
 * Format des messages : ICU (paramètres `{nom}`, pluriels), compatible next-intl.
 */
export const CATALOGS = {
  fr: {
    common: frCommon,
    auth: frAuth,
    errors: frErrors,
    validation: frValidation,
    landing: frLanding,
    emails: frEmails,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    errors: enErrors,
    validation: enValidation,
    landing: enLanding,
    emails: enEmails,
  },
} as const satisfies Record<I18nLocale, Record<string, MessageTree>>;

export type Namespace = keyof (typeof CATALOGS)['fr'];

/** Espaces de noms envoyés au navigateur (les emails restent côté serveur). */
export const WEB_NAMESPACES = ['common', 'auth', 'errors', 'validation'] as const;

/** Messages des composants client (envoyés au navigateur). */
export function getClientMessages(locale: I18nLocale) {
  const catalog = CATALOGS[locale];
  return {
    common: catalog.common,
    auth: catalog.auth,
    errors: catalog.errors,
    validation: catalog.validation,
  };
}

/**
 * Messages de l'interface web pour next-intl, côté serveur : ceux des composants client, plus
 * les textes rendus uniquement par le serveur (page d'accueil), qui ne partent pas au navigateur.
 */
export function getWebMessages(locale: I18nLocale) {
  return { ...getClientMessages(locale), landing: CATALOGS[locale].landing };
}

export type WebMessages = ReturnType<typeof getWebMessages>;

/** Traducteur simple (paramètres `{nom}`) lié à une langue et un espace de noms, pour l'API. */
export function getTranslator(
  locale: I18nLocale,
  namespace: Namespace,
): (key: string, params?: MessageParams) => string {
  const messages: MessageTree = CATALOGS[locale][namespace];
  return (key, params) => translate(messages, key, params);
}
