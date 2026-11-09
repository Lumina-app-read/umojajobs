import { describe, expect, it } from 'vitest';
import { APP_NAV_ITEMS, APP_TABS, isActive, UPCOMING_SECTIONS } from './app-nav';

describe('navigation de l’espace connecté', () => {
  it('la vue d’ensemble n’est active que sur sa propre adresse', () => {
    expect(isActive('/dashboard', '/dashboard')).toBe(true);
    expect(isActive('/dashboard/wallet', '/dashboard')).toBe(false);
  });

  it('une rubrique reste active sur ses sous-pages, sans confondre les préfixes', () => {
    expect(isActive('/dashboard/wallet', '/dashboard/wallet')).toBe(true);
    expect(isActive('/dashboard/wallet/history', '/dashboard/wallet')).toBe(true);
    expect(isActive('/dashboard/walletx', '/dashboard/wallet')).toBe(false);
  });

  it('les rubriques disponibles ne passent pas par la page « Bientôt disponible »', () => {
    const upcoming = UPCOMING_SECTIONS.map((item) => item.key);
    expect(upcoming).not.toContain('overview');
    expect(upcoming).not.toContain('settings');
  });

  it('chaque onglet mobile mène à une rubrique de la navigation', () => {
    const hrefs = APP_NAV_ITEMS.map((item) => item.href);
    for (const tab of APP_TABS) expect(hrefs).toContain(tab.href);
  });
});
