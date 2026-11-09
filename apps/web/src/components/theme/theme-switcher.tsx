'use client';

import { type ThemePreference } from '@opportinities/shared';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';
import {
  applyTheme,
  getThemePreference,
  resolveTheme,
  saveThemePreference,
  subscribeThemePreference,
} from '@/lib/theme';

const OPTIONS: { value: ThemePreference; Icon: typeof Sun }[] = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
  { value: 'system', Icon: Monitor },
];

/** Sélecteur clair / sombre / système. La préférence est mémorisée dans un cookie (un an). */
export function ThemeSwitcher() {
  const t = useTranslations('common.theme');
  const preference = useSyncExternalStore(
    subscribeThemePreference,
    getThemePreference,
    (): ThemePreference => 'system',
  );

  // Applique le thème choisi et, en mode « système », suit les changements du système d'exploitation.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(resolveTheme(preference, media.matches));
    update();
    if (preference !== 'system') return undefined;
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [preference]);

  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className="flex rounded-md border border-border bg-surface p-0.5"
    >
      {OPTIONS.map(({ value, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          aria-label={t(value)}
          title={t(value)}
          onClick={() => saveThemePreference(value)}
          className={cn(
            'flex size-8 items-center justify-center rounded',
            preference === value
              ? 'bg-surface-muted text-primary'
              : 'text-muted hover:text-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
