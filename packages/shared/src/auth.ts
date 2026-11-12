/** Rôles de la plateforme (CLAUDE.md §15). Un compte peut cumuler plusieurs rôles. */
export const ROLE_CODES = ['user', 'moderator', 'admin', 'super_admin'] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

/** Rôles pour lesquels la double authentification (TOTP) est obligatoire (décision D7). */
export const MFA_REQUIRED_ROLES: readonly RoleCode[] = ['admin', 'super_admin'];

/**
 * Permissions vérifiées côté API. Le frontend ne s'en sert que pour adapter l'affichage :
 * il ne remplace jamais le contrôle du backend.
 */
export const PERMISSIONS = {
  ADMIN_ACCESS: 'admin.access',
  USERS_READ: 'users.read',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  JOBS_MODERATE: 'jobs.moderate',
  SECURITY_EVENTS_READ: 'security_events.read',
  AUDIT_LOGS_READ: 'audit_logs.read',
  SETTINGS_MANAGE: 'settings.manage',
  FINANCE_READ: 'finance.read',
  FINANCE_MANAGE: 'finance.manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Règles de mot de passe (recommandations NIST SP 800-63B : longueur plutôt que complexité). */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PERSON_NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;

/** États de la double authentification pour la session courante. */
export const MFA_STATES = [
  'not_required',
  'enrollment_required',
  'verification_required',
  'verified',
] as const;
export type MfaState = (typeof MFA_STATES)[number];

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** Numéro de téléphone au format international E.164 : « + », indicatif puis numéro (8 à 15 chiffres). */
export const PHONE_E164 = /^\+[1-9]\d{7,14}$/;

/** Types d'événements du journal de sécurité (alignés sur l'énumération de la base, vérifié par test). */
export const SECURITY_EVENT_TYPES = [
  'user_registered',
  'registration_attempt_existing_email',
  'email_verification_sent',
  'email_verified',
  'login_succeeded',
  'login_failed',
  'account_locked',
  'logout',
  'logout_all',
  'session_revoked',
  'password_reset_requested',
  'password_reset_completed',
  'password_changed',
  'mfa_enrollment_started',
  'mfa_enabled',
  'mfa_verified',
  'mfa_failed',
  'mfa_recovery_code_used',
  'role_granted',
  'role_revoked',
  'profile_updated',
  'contributor_terms_accepted',
  'candidate_terms_accepted',
  'financial_setting_changed',
  'credits_granted',
  'withdrawal_requested',
  'withdrawal_status_changed',
] as const;
export type SecurityEventTypeCode = (typeof SECURITY_EVENT_TYPES)[number];
