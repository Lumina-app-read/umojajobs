'use client';

import { Cookie } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useSyncExternalStore } from 'react';
import {
  type ConsentCategory,
  getConsentSnapshot,
  hasConsent,
  openCookiePreferences,
  subscribeConsent,
} from '@/lib/consent';
import { cn } from '@/lib/cn';

/** La catégorie est-elle acceptée ? Toujours faux côté serveur et avant l'hydratation. */
export function useConsent(category: ConsentCategory): boolean {
  return useSyncExternalStore(
    subscribeConsent,
    () => hasConsent(getConsentSnapshot(), category),
    () => false,
  );
}

/**
 * Point d'entrée obligatoire de tout script ou contenu non essentiel (mesure d'audience,
 * marketing) : rien n'est rendu, donc rien n'est chargé, avant le consentement correspondant.
 */
export function ConsentGate({
  category,
  children,
}: {
  category: ConsentCategory;
  children: ReactNode;
}) {
  return useConsent(category) ? children : null;
}

/** Lien permanent « Préférences des cookies » : rouvre le panneau de consentement. */
export function CookiePreferencesLink({ className }: { className?: string }) {
  const t = useTranslations('common.cookies');
  return (
    <button
      type="button"
      onClick={openCookiePreferences}
      className={cn('inline-flex items-center gap-1.5 text-left', className)}
    >
      <Cookie className="size-3.5 shrink-0" aria-hidden="true" />
      {t('preferencesLink')}
    </button>
  );
}
