import { describe, expect, it } from 'vitest';
import { readRegistryState, registryHref } from './query';

const STATUSES = ['pending', 'paid'] as const;

describe('adresse des registres', () => {
  it('lit la recherche, l’état et la page, en bornant les valeurs', () => {
    expect(readRegistryState({ q: ' awa ', status: 'paid', page: '3' }, STATUSES)).toEqual({
      q: 'awa',
      status: 'paid',
      page: 3,
    });
    expect(readRegistryState({ status: 'autre', page: '-2' }, STATUSES)).toEqual({
      q: '',
      status: null,
      page: 1,
    });
    expect(readRegistryState({ page: '1.5' }, STATUSES).page).toBe(1);
    expect(readRegistryState({ page: '99999999' }, STATUSES).page).toBe(1000);
    expect(readRegistryState({ q: 'x'.repeat(300) }, STATUSES).q).toHaveLength(120);
  });

  it('reconstruit une adresse minimale', () => {
    expect(registryHref('/admin/payments', { q: '', status: null, page: 1 })).toBe(
      '/admin/payments',
    );
    expect(registryHref('/admin/payments', { q: 'a&b', status: 'paid', page: 2 })).toBe(
      '/admin/payments?q=a%26b&status=paid&page=2',
    );
  });
});
