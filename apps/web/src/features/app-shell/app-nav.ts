import {
  ArrowDownToLine,
  Bell,
  Bookmark,
  Briefcase,
  Files,
  HandCoins,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Settings,
  SquarePlus,
  Sparkles,
  Unlock,
  UserRound,
  Wallet,
} from 'lucide-react';

/** Rubrique de l'espace connecté. `phase` : module qui la rendra fonctionnelle (null = disponible). */
export interface AppNavItem {
  key:
    | 'overview'
    | 'jobs'
    | 'saved'
    | 'unlocked'
    | 'publications'
    | 'publish'
    | 'wallet'
    | 'commissions'
    | 'withdrawals'
    | 'studio'
    | 'documents'
    | 'notifications'
    | 'settings';
  href: string;
  icon: LucideIcon;
  phase: 2 | 3 | 4 | 5 | null;
}

export interface AppNavGroup {
  key: 'main' | 'offers' | 'contribute' | 'finances' | 'studio' | 'account';
  items: AppNavItem[];
}

/** Navigation groupée de l'espace connecté (design system §10). Source unique pour toutes les vues. */
export const APP_NAV: AppNavGroup[] = [
  {
    key: 'main',
    items: [{ key: 'overview', href: '/dashboard', icon: LayoutDashboard, phase: null }],
  },
  {
    key: 'offers',
    items: [
      { key: 'jobs', href: '/dashboard/jobs', icon: Briefcase, phase: null },
      { key: 'saved', href: '/dashboard/saved', icon: Bookmark, phase: null },
      { key: 'unlocked', href: '/dashboard/unlocked', icon: Unlock, phase: null },
    ],
  },
  {
    key: 'contribute',
    items: [
      { key: 'publications', href: '/dashboard/publications', icon: Megaphone, phase: null },
      { key: 'publish', href: '/dashboard/publish', icon: SquarePlus, phase: null },
    ],
  },
  {
    key: 'finances',
    items: [
      { key: 'wallet', href: '/dashboard/wallet', icon: Wallet, phase: null },
      { key: 'commissions', href: '/dashboard/commissions', icon: HandCoins, phase: null },
      { key: 'withdrawals', href: '/dashboard/withdrawals', icon: ArrowDownToLine, phase: null },
    ],
  },
  {
    key: 'studio',
    items: [
      { key: 'studio', href: '/dashboard/studio', icon: Sparkles, phase: 4 },
      { key: 'documents', href: '/dashboard/documents', icon: Files, phase: 4 },
    ],
  },
  {
    key: 'account',
    items: [
      { key: 'notifications', href: '/dashboard/notifications', icon: Bell, phase: 5 },
      { key: 'settings', href: '/dashboard/settings', icon: Settings, phase: null },
    ],
  },
];

export const APP_NAV_ITEMS: AppNavItem[] = APP_NAV.flatMap((group) => group.items);

/** Rubriques à venir, servies par la route dynamique `/dashboard/[section]`. */
export const UPCOMING_SECTIONS = APP_NAV_ITEMS.filter((item) => item.phase !== null);

/** Barre d'onglets mobile : les cinq destinations les plus fréquentes. */
export const APP_TABS: {
  key: 'home' | 'offers' | 'publish' | 'studio' | 'account';
  href: string;
  icon: LucideIcon;
}[] = [
  { key: 'home', href: '/dashboard', icon: LayoutDashboard },
  { key: 'offers', href: '/dashboard/jobs', icon: Briefcase },
  { key: 'publish', href: '/dashboard/publish', icon: SquarePlus },
  { key: 'studio', href: '/dashboard/studio', icon: Sparkles },
  { key: 'account', href: '/dashboard/settings', icon: UserRound },
];

/** Racines des espaces : actives seulement sur leur propre adresse. */
const ROOTS = new Set(['/dashboard', '/admin']);

/** Rubrique active : une racine sur sa propre adresse, les autres rubriques par préfixe. */
export function isActive(pathname: string, href: string): boolean {
  if (ROOTS.has(href)) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
