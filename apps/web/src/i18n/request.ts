import { getWebMessages } from '@opportinities/i18n';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as rootParams from 'next/root-params';
import { routing } from './routing';

/** Langue et messages de chaque requête. Les textes viennent du catalogue centralisé @opportinities/i18n. */
export default getRequestConfig(async ({ locale }) => {
  let resolved = locale;
  if (!resolved) {
    const paramValue = await rootParams.locale();
    if (!hasLocale(routing.locales, paramValue)) {
      notFound();
    }
    resolved = paramValue;
  }
  if (!hasLocale(routing.locales, resolved)) {
    notFound();
  }

  return {
    locale: resolved,
    messages: getWebMessages(resolved),
  };
});
