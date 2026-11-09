import {
  MFA_REQUIRED_ROLES,
  type MfaState,
  PERMISSIONS,
  type PermissionCode,
  type RoleCode,
} from '@opportinities/shared';

/** Description des permissions (stockée en base, affichée dans l'administration). */
export const PERMISSION_DESCRIPTIONS: Record<PermissionCode, string> = {
  [PERMISSIONS.ADMIN_ACCESS]: "Accéder à l'espace d'administration",
  [PERMISSIONS.USERS_READ]: 'Consulter les utilisateurs',
  [PERMISSIONS.USERS_MANAGE]: 'Modifier, suspendre ou réactiver les utilisateurs',
  [PERMISSIONS.ROLES_MANAGE]: 'Attribuer ou retirer des rôles',
  [PERMISSIONS.JOBS_MODERATE]: 'Modérer les offres',
  [PERMISSIONS.SECURITY_EVENTS_READ]: 'Consulter le journal de sécurité',
  [PERMISSIONS.AUDIT_LOGS_READ]: "Consulter les journaux d'audit",
  [PERMISSIONS.SETTINGS_MANAGE]: 'Modifier les paramètres de la plateforme',
};

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/**
 * Permissions par rôle. Le rôle `user` n'a aucune permission d'administration :
 * les actions sur ses propres données sont contrôlées par propriété, pas par permission.
 */
export const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  user: [],
  moderator: [PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.JOBS_MODERATE],
  admin: [
    PERMISSIONS.ADMIN_ACCESS,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.JOBS_MODERATE,
    PERMISSIONS.SECURITY_EVENTS_READ,
    PERMISSIONS.AUDIT_LOGS_READ,
  ],
  super_admin: ALL_PERMISSIONS,
};

/**
 * État de la double authentification pour une session :
 * obligatoire pour admin et super_admin, et pour tout compte qui l'a activée volontairement.
 */
export function computeMfaState(
  roles: readonly RoleCode[],
  totpEnabled: boolean,
  sessionMfaVerified: boolean,
): MfaState {
  const required = totpEnabled || roles.some((role) => MFA_REQUIRED_ROLES.includes(role));
  if (!required) return 'not_required';
  if (!totpEnabled) return 'enrollment_required';
  return sessionMfaVerified ? 'verified' : 'verification_required';
}
