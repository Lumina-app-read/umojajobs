import { getWebMessages } from '@opportinities/i18n';
import { render, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { type ReactElement } from 'react';

/** Rendu avec les vrais catalogues de traduction (aucun texte simulé). */
export function renderWithIntl(ui: ReactElement, locale: 'fr' | 'en' = 'fr'): RenderResult {
  return render(
    <NextIntlClientProvider locale={locale} messages={getWebMessages(locale)} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}

/** Réponse HTTP simulée pour fetch. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
