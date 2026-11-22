import { type RoleCode } from '@opportinities/shared';
import { ROLE_PERMISSIONS } from '../auth/rbac';
import { rolesRefusal, statusRefusal, type UserAdminActor } from './user-admin-rules';

const actor = (role: RoleCode): UserAdminActor => ({
  id: 'acteur',
  roles: ['user', role],
  permissions: new Set<string>(ROLE_PERMISSIONS[role]),
});
const target = (role: RoleCode, id = 'cible') => ({ id, roles: ['user', role] as RoleCode[] });

describe('statusRefusal', () => {
  it.each([
    ['user', 'user', 'forbidden'],
    ['moderator', 'user', 'forbidden'],
    ['admin', 'user', null],
    ['admin', 'moderator', null],
    ['admin', 'admin', 'forbidden'],
    ['admin', 'super_admin', 'forbidden'],
    ['super_admin', 'user', null],
    ['super_admin', 'admin', null],
    ['super_admin', 'super_admin', null],
  ] as const)('%s sur %s : %s', (from, to, expected) => {
    expect(statusRefusal(actor(from), target(to))).toBe(expected);
  });

  it('refuse toujours d’agir sur soi-même', () => {
    expect(statusRefusal(actor('super_admin'), target('super_admin', 'acteur'))).toBe('self');
  });
});

describe('rolesRefusal', () => {
  it.each([
    ['user', 'forbidden'],
    ['moderator', 'forbidden'],
    ['admin', 'forbidden'],
    ['super_admin', null],
  ] as const)('%s : %s', (from, expected) => {
    expect(rolesRefusal(actor(from), target('user'))).toBe(expected);
  });

  it('refuse toujours de changer ses propres rôles', () => {
    expect(rolesRefusal(actor('super_admin'), target('super_admin', 'acteur'))).toBe('self');
  });
});
