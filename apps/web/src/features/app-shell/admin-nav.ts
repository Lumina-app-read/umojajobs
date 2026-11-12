import { PERMISSIONS, type PermissionCode } from '@opportinities/shared';
import {
  ArrowDownToLine,
  BadgePercent,
  Bell,
  CreditCard,
  FileClock,
  Globe2,
  HandCoins,
  KeyRound,
  Languages,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Users,
} from 'lucide-react';

/**
 * Rubrique de l'administration (CLAUDE.md §15). `permission` : droit requis pour la voir.
 * `phase` : module qui la rendra fonctionnelle ; `next` : étape à planifier ; null : disponible.
 */
export interface AdminNavItem {
  key:
    | 'overview'
    | 'users'
    | 'roles'
    | 'moderation'
    | 'catalog'
    | 'payments'
    | 'unlocks'
    | 'commissions'
    | 'withdrawals'
    | 'pricing'
    | 'notifications'
    | 'translations'
    | 'settings'
    | 'auditLogs'
    | 'securityEvents';
  href: string;
  icon: LucideIcon;
  permission: PermissionCode;
  phase: 2 | 3 | 4 | 5 | 'next' | null;
}

export interface AdminNavGroup {
  key: 'main' | 'content' | 'finances' | 'platform' | 'audit';
  items: AdminNavItem[];
}

const { ADMIN_ACCESS, USERS_READ, ROLES_MANAGE, JOBS_MODERATE, SETTINGS_MANAGE } = PERMISSIONS;

/** Finances : consultation avec finance.read ; les modifications exigent finance.manage. */
const FINANCE_PERMISSION = PERMISSIONS.FINANCE_READ;

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    key: 'main',
    items: [
      {
        key: 'overview',
        href: '/admin',
        icon: LayoutDashboard,
        permission: ADMIN_ACCESS,
        phase: null,
      },
    ],
  },
  {
    key: 'content',
    items: [
      {
        key: 'moderation',
        href: '/admin/moderation',
        icon: ShieldCheck,
        permission: JOBS_MODERATE,
        phase: null,
      },
      {
        key: 'catalog',
        href: '/admin/catalog',
        icon: Globe2,
        permission: SETTINGS_MANAGE,
        phase: 2,
      },
      {
        key: 'pricing',
        href: '/admin/finance',
        icon: BadgePercent,
        permission: FINANCE_PERMISSION,
        phase: null,
      },
    ],
  },
  {
    key: 'finances',
    items: [
      {
        key: 'payments',
        href: '/admin/payments',
        icon: CreditCard,
        permission: FINANCE_PERMISSION,
        phase: 3,
      },
      {
        key: 'unlocks',
        href: '/admin/unlocks',
        icon: Unlock,
        permission: FINANCE_PERMISSION,
        phase: 3,
      },
      {
        key: 'commissions',
        href: '/admin/commissions',
        icon: HandCoins,
        permission: FINANCE_PERMISSION,
        phase: 3,
      },
      {
        key: 'withdrawals',
        href: '/admin/withdrawals',
        icon: ArrowDownToLine,
        permission: FINANCE_PERMISSION,
        phase: 3,
      },
    ],
  },
  {
    key: 'platform',
    items: [
      { key: 'users', href: '/admin/users', icon: Users, permission: USERS_READ, phase: 'next' },
      {
        key: 'roles',
        href: '/admin/roles',
        icon: KeyRound,
        permission: ROLES_MANAGE,
        phase: 'next',
      },
      {
        key: 'notifications',
        href: '/admin/notifications',
        icon: Bell,
        permission: SETTINGS_MANAGE,
        phase: 5,
      },
      {
        key: 'translations',
        href: '/admin/translations',
        icon: Languages,
        permission: SETTINGS_MANAGE,
        phase: 5,
      },
      {
        key: 'settings',
        href: '/admin/settings',
        icon: Settings,
        permission: SETTINGS_MANAGE,
        phase: 5,
      },
    ],
  },
  {
    key: 'audit',
    items: [
      {
        key: 'auditLogs',
        href: '/admin/audit-logs',
        icon: FileClock,
        permission: PERMISSIONS.AUDIT_LOGS_READ,
        phase: 5,
      },
      {
        key: 'securityEvents',
        href: '/admin/security-events',
        icon: ShieldAlert,
        permission: PERMISSIONS.SECURITY_EVENTS_READ,
        phase: null,
      },
    ],
  },
];

/** Groupes visibles pour un ensemble de permissions (les groupes vides disparaissent). */
export function visibleAdminNav(permissions: readonly string[]): AdminNavGroup[] {
  return ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((group) => group.items);
