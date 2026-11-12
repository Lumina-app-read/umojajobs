import { PERMISSIONS } from '@opportinities/shared';
import { describe, expect, it } from 'vitest';
import { ADMIN_NAV_ITEMS, visibleAdminNav } from './admin-nav';

const keys = (permissions: string[]) =>
  visibleAdminNav(permissions).flatMap((group) => group.items.map((item) => item.key));

describe('navigation de l’administration', () => {
  it('un modérateur ne voit que la vue d’ensemble et la modération', () => {
    expect(keys([PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.JOBS_MODERATE])).toEqual([
      'overview',
      'moderation',
    ]);
  });

  it('les groupes sans rubrique visible disparaissent', () => {
    const groups = visibleAdminNav([PERMISSIONS.ADMIN_ACCESS]).map((group) => group.key);
    expect(groups).toEqual(['main']);
  });

  it('les finances exigent la permission de consultation financière', () => {
    const admin = keys([
      PERMISSIONS.ADMIN_ACCESS,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.SECURITY_EVENTS_READ,
    ]);
    expect(admin).toContain('securityEvents');
    expect(admin).not.toContain('pricing');
    expect(keys([PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.FINANCE_READ])).toEqual([
      'overview',
      'pricing',
      'payments',
      'unlocks',
      'commissions',
    ]);
    expect(keys(Object.values(PERMISSIONS))).toHaveLength(ADMIN_NAV_ITEMS.length);
  });
});
