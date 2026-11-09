import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readThemeCookie, resolveTheme, THEME_BOOTSTRAP_SCRIPT, themeCookieValue } from './theme';

function runBootstrap(systemDark: boolean): void {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: systemDark } as MediaQueryList);
  // Exécute le script inline tel qu'il est injecté dans le <head>.
  new Function(THEME_BOOTSTRAP_SCRIPT)();
}

describe('thème', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
  });

  it('résout la préférence système', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('lit le cookie et ignore une valeur invalide', () => {
    expect(readThemeCookie('a=1; oppo_theme=dark; b=2')).toBe('dark');
    expect(readThemeCookie('oppo_theme=violet')).toBe('system');
    expect(readThemeCookie('')).toBe('system');
  });

  it('mémorise la préférence un an, sur tout le site', () => {
    expect(themeCookieValue('dark')).toBe(
      'oppo_theme=dark; Path=/; Max-Age=31536000; SameSite=Lax',
    );
  });

  it('script anti-flash : applique le thème sombre mémorisé avant affichage', () => {
    document.cookie = 'oppo_theme=dark';
    runBootstrap(false);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('script anti-flash : suit le système en l’absence de préférence', () => {
    runBootstrap(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('script anti-flash : le thème clair choisi l’emporte sur un système sombre', () => {
    document.cookie = 'oppo_theme=light';
    runBootstrap(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
