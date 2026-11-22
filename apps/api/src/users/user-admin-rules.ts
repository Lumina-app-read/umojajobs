import { PERMISSIONS, type RoleCode } from '@opportinities/shared';

export interface UserAdminActor {
  id: string;
  roles: readonly RoleCode[];
  permissions: ReadonlySet<string>;
}

export interface UserAdminTarget {
  id: string;
  roles: readonly RoleCode[];
}

export type UserAdminRefusal = 'self' | 'forbidden';

const isPrivileged = (roles: readonly RoleCode[]) =>
  roles.includes('admin') || roles.includes('super_admin');

/**
 * Suspendre ou réactiver (règles du 22 novembre 2026) : jamais soi-même ; un administrateur agit sur
 * les utilisateurs et les modérateurs ; seul un super administrateur agit sur un administrateur.
 */
export function statusRefusal(
  actor: UserAdminActor,
  target: UserAdminTarget,
): UserAdminRefusal | null {
  if (actor.id === target.id) return 'self';
  if (!actor.permissions.has(PERMISSIONS.USERS_MANAGE)) return 'forbidden';
  if (isPrivileged(target.roles) && !actor.roles.includes('super_admin')) return 'forbidden';
  return null;
}

/** Attribuer ou retirer un rôle : super administrateur seulement, et jamais le sien. */
export function rolesRefusal(
  actor: UserAdminActor,
  target: UserAdminTarget,
): UserAdminRefusal | null {
  if (actor.id === target.id) return 'self';
  if (!actor.permissions.has(PERMISSIONS.ROLES_MANAGE) || !actor.roles.includes('super_admin')) {
    return 'forbidden';
  }
  return null;
}
