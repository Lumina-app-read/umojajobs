import { getClientMessages } from '@opportinities/i18n';
import { APP_NAME } from '@opportinities/shared';
import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import { type ReactNode } from 'react';
import { FlagEmojiPolyfill } from '@/components/layout/flag-emoji-polyfill';
import { ThemeScript } from '@/components/theme/theme-script';
import { Toaster } from '@/components/ui/toast';
import { routing } from '@/i18n/routing';
import '../globals.css';

// Plus Jakarta Sans (police variable 200-800) est téléchargée au build et servie depuis notre domaine :
// aucun appel à Google côté client.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-jakarta',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.meta');
  return {
    title: { default: `${APP_NAME} · ${t('tagline')}`, template: `%s · ${APP_NAME}` },
    description: t('description'),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111829' },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations('common.nav');

  return (
    // La classe .dark est posée par le script ci-dessous avant le premier affichage.
    <html
      lang={locale}
      className={jakarta.variable}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        {/* Seuls les messages des composants client partent au navigateur (pas ceux de l'accueil). */}
        <NextIntlClientProvider messages={getClientMessages(locale)}>
          <FlagEmojiPolyfill />
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-raised focus:px-4 focus:py-2 focus:shadow"
          >
            {t('skipToContent')}
          </a>
          {/* Chaque groupe fournit sa structure : site public (site) ou espace connecté (app). */}
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
