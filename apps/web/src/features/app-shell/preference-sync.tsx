'use client';

import { type Locale, type ThemePreference } from '@opportinities/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { getThemePreference, subscribeThemePreference } from '@/lib/theme';

/**
 * Synchronise la langue et le thème de l'appareil avec le compte, dans l'espace connecté.
 * Le compte fait foi à la connexion (voir LoginForm) ; ensuite, le dernier choix de l'utilisateur,
 * sur n'importe quel appareil, est enregistré. En cas d'échec, le choix reste local et un message
 * l'indique.
 */
export function PreferenceSync({ theme, locale }: { theme: ThemePreference; locale: Locale }) {
  const t = useTranslations('common.app.settings');
  const currentLocale = useLocale() as Locale;
  const router = useRouter();

  useEffect(() => {
    const save = (update: { theme?: ThemePreference; locale?: Locale }) =>
      api
        .patch('/auth/me', update)
        .then(() => router.refresh())
        .catch(() => toast.error(t('preferencesError')));

    // Langue : l'adresse (/fr, /en) reflète le dernier choix.
    if (currentLocale !== locale) void save({ locale: currentLocale });
    // Thème : choix fait hors de l'espace connecté, puis chaque changement ultérieur.
    if (getThemePreference() !== theme) void save({ theme: getThemePreference() });
    return subscribeThemePreference(() => {
      const preference = getThemePreference();
      if (preference !== theme) void save({ theme: preference });
    });
  }, [currentLocale, locale, theme, router, t]);

  return null;
}
