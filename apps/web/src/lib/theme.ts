import { THEME_PREFERENCES, type ThemePreference } from '@opportinities/shared';

export const THEME_COOKIE = 'oppo_theme';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Thème effectif : la préférence « système » suit le réglage du système d'exploitation. */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): 'light' | 'dark' {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

export function readThemeCookie(cookieHeader: string): ThemePreference {
  const match = new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]+)`).exec(cookieHeader);
  const value = match?.[1];
  return isThemePreference(value) ? value : 'system';
}

export function themeCookieValue(preference: ThemePreference): string {
  return `${THEME_COOKIE}=${preference}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export function applyTheme(theme: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

/**
 * Script exécuté dans le <head>, avant le premier affichage : applique le thème mémorisé et
 * évite le flash du mauvais thème. Il reprend la logique de readThemeCookie et resolveTheme.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);var p=m?m[1]:'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');}r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

// --- Préférence côté navigateur (source : cookie), lue via useSyncExternalStore -----------------

const listeners = new Set<() => void>();

export function subscribeThemePreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getThemePreference(): ThemePreference {
  return readThemeCookie(document.cookie);
}

/** Enregistre la préférence (cookie d'un an) et prévient les composants abonnés. */
export function saveThemePreference(preference: ThemePreference): void {
  document.cookie = themeCookieValue(preference);
  listeners.forEach((listener) => listener());
}
