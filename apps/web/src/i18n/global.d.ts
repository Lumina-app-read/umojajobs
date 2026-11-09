import { type WebMessages } from '@opportinities/i18n';
import { type routing } from './routing';

/** Clés de traduction et langues vérifiées à la compilation. */
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: WebMessages;
  }
}
