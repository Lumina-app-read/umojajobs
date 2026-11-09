'use client';

import { SUPPORTED_LOCALES, type ThemePreference } from '@opportinities/shared';
import { useTranslations } from 'next-intl';
import { THEME_ICONS, useThemePreference } from '@/components/theme/theme-menu';
import { SegmentedControl } from '@/components/ui/navigation';
import { saveThemePreference } from '@/lib/theme';
import { useLocaleSwitch } from './language-menu';

/**
 * Réglages de langue (FR / EN) et de thème (clair, sombre, système) en contrôles segmentés.
 * Utilisés dans les tiroirs mobiles et la page Paramètres.
 */
export function PreferenceControls() {
  const t = useTranslations('common');
  const { locale, switchLocale, pending } = useLocaleSwitch();
  const theme = useThemePreference();

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-fg-muted">{t('language.label')}</span>
        <SegmentedControl
          label={t('language.label')}
          value={locale}
          onChange={(target) => !pending && switchLocale(target)}
          options={SUPPORTED_LOCALES.map((value) => ({
            value,
            label: <span lang={value}>{value.toUpperCase()}</span>,
          }))}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-fg-muted">{t('theme.label')}</span>
        <SegmentedControl<ThemePreference>
          label={t('theme.label')}
          value={theme}
          onChange={saveThemePreference}
          options={(['light', 'dark', 'system'] as const).map((value) => {
            const Icon = THEME_ICONS[value];
            return {
              value,
              label: (
                <>
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="sr-only">{t(`theme.${value}`)}</span>
                </>
              ),
            };
          })}
        />
      </div>
    </div>
  );
}
