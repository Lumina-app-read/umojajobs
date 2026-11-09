import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@opportinities/shared';
import { defineRouting } from 'next-intl/routing';

/** Routage bilingue : toutes les URLs sont préfixées par la langue (/fr/..., /en/...). */
export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});
