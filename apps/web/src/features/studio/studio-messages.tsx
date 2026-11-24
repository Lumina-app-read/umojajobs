import { getStudioClientMessages, type I18nLocale } from '@opportinities/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { type ReactNode } from 'react';

/**
 * Ajoute les messages du Career Studio et des dossiers aux composants client de la section.
 * Les autres pages ne les reçoivent pas, ce qui allège chaque page publique.
 */
export async function StudioMessages({ children }: { children: ReactNode }) {
  const locale = (await getLocale()) as I18nLocale;
  return (
    <NextIntlClientProvider messages={getStudioClientMessages(locale)}>
      {children}
    </NextIntlClientProvider>
  );
}
