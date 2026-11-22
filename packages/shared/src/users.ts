import { type PermissionCode, type RoleCode, type SecurityEventTypeCode } from './auth';
import { type RegistryPage } from './registry';

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Filtres de la liste des utilisateurs. */
export const USER_FILTERS = ['active', 'suspended', 'unverified', 'staff'] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

/** Rôles attribuables par l'administration (chaque compte garde toujours le rôle « user »). */
export const STAFF_ROLES = ['moderator', 'admin', 'super_admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const USER_ADMIN_LIMITS = { reasonMin: 10, reasonMax: 500 } as const;

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  countryIso2: string;
  status: UserStatus;
  roles: RoleCode[];
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface UserRegistrySummary {
  total: number;
  newThisMonth: number;
  suspended: number;
  staff: number;
}

export type UserRegistryResponse = RegistryPage<AdminUserSummary, UserRegistrySummary>;

export interface AdminUserEvent {
  id: string;
  type: SecurityEventTypeCode;
  /** Administrateur à l'origine de l'action, null si l'utilisateur ou le système. */
  actor: string | null;
  reason: string | null;
  role: RoleCode | null;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserSummary {
  phoneE164: string | null;
  locale: 'fr' | 'en';
  activity: {
    publications: number;
    unlocks: number;
    documents: number;
    activeSessions: number;
  };
  /** Solde de crédits (null sans la permission de consultation financière). */
  credits: number | null;
  /** Derniers événements du compte (null sans la permission de lire le journal). */
  events: AdminUserEvent[] | null;
  /** Actions permises à l'administrateur connecté ; l'API les vérifie de nouveau. */
  can: { suspend: boolean; reactivate: boolean; manageRoles: boolean };
}

export interface UserStatusInput {
  reason: string;
}

export interface UserRoleInput {
  role: StaffRole;
  /** Vrai pour attribuer le rôle, faux pour le retirer. */
  granted: boolean;
  reason: string;
}

export interface AdminRolesResponse {
  roles: { code: RoleCode; permissions: PermissionCode[]; members: number }[];
  /** Comptes ayant au moins un rôle d'administration. */
  staff: AdminUserSummary[];
}
