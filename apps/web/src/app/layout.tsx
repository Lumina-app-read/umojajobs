import { APP_NAME, DEFAULT_LOCALE } from '@opportinities/shared';
import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import { type ReactNode } from 'react';
import './globals.css';

// IBM Plex Sans est téléchargée au build et servie depuis notre domaine (aucun appel à Google côté client).
const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: APP_NAME,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // La langue sera déterminée par la route (/fr, /en) à partir de la phase 1d.
  return (
    <html lang={DEFAULT_LOCALE} className={plexSans.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
