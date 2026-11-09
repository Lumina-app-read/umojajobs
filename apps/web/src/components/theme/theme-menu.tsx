'use client';

import { type ThemePreference } from '@opportinities/shared';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useSyncExternalStore } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { SelectMenu } from '@/components/ui/select-menu';
import { cn } from '@/lib/cn';
import {
  applyTheme,
  getThemePreference,
  resolveTheme,
  saveThemePreference,
  subscribeThemePreference,
} from '@/lib/theme';

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Sélecteur de thème unique : un bouton dont l'icône reflète la préférence (soleil, lune, écran),
 * qui ouvre un menu Clair / Sombre / Système. La préférence est mémorisée (cookie d'un an).
 */
export function ThemeMenu({ className }: { className?: string }) {
  const t = useTranslations('common.theme');
  const preference = useSyncExternalStore(
    subscribeThemePreference,
    getThemePreference,
    (): ThemePreference => 'system',
  );

  // Applique le thème choisi et, en mode « Système », suit les changements du système d'exploitation.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(resolveTheme(preference, media.matches));
    update();
    if (preference !== 'system') return undefined;
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [preference]);

  const Icon = ICONS[preference];

  return (
    <SelectMenu<ThemePreference>
      value={preference}
      onChange={saveThemePreference}
      label={t('label')}
      options={(['light', 'dark', 'system'] as const).map((value) => ({
        value,
        label: t(value),
        icon: ICONS[value],
      }))}
      triggerClassName={cn(buttonClasses('ghost', 'md'), 'size-9 px-0', className)}
      trigger={<Icon className="size-[18px]" aria-hidden="true" />}
    />
  );
}
