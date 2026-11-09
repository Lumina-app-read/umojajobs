import { PERMISSIONS } from '@opportinities/shared';
import { computeMfaState, PERMISSION_DESCRIPTIONS, ROLE_PERMISSIONS } from './rbac';

describe('RBAC', () => {
  it('décrit chaque permission', () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(PERMISSION_DESCRIPTIONS[permission]).toBeTruthy();
    }
  });

  it("n'accorde aucune permission d'administration au rôle user", () => {
    expect(ROLE_PERMISSIONS.user).toEqual([]);
  });

  it('accorde toutes les permissions au super_admin', () => {
    expect([...ROLE_PERMISSIONS.super_admin].sort()).toEqual(Object.values(PERMISSIONS).sort());
  });

  it('réserve la gestion des rôles et des paramètres au super_admin', () => {
    for (const role of ['user', 'moderator', 'admin'] as const) {
      expect(ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.ROLES_MANAGE);
      expect(ROLE_PERMISSIONS[role]).not.toContain(PERMISSIONS.SETTINGS_MANAGE);
    }
  });
});

describe('computeMfaState', () => {
  it.each([
    [['user'], false, false, 'not_required'],
    [['user', 'moderator'], false, false, 'not_required'],
    [['user', 'admin'], false, false, 'enrollment_required'],
    [['user', 'super_admin'], false, false, 'enrollment_required'],
    [['user', 'admin'], true, false, 'verification_required'],
    [['user', 'admin'], true, true, 'verified'],
    [['user'], true, false, 'verification_required'],
    [['user'], true, true, 'verified'],
  ] as const)('rôles %j, TOTP %s, session vérifiée %s → %s', (roles, enabled, verified, state) => {
    expect(computeMfaState(roles, enabled, verified)).toBe(state);
  });
});
