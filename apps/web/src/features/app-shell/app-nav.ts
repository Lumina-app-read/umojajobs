import {
  ArrowDownToLine,
  Bell,
  Bookmark,
  Files,
  HandCoins,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Search,
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
      { key: 'jobs', href: '/dashboard/jobs', icon: Search, phase: 2 },
      { key: 'saved', href: '/dashboard/saved', icon: Bookmark, phase: 2 },
      { key: 'unlocked', href: '/dashboard/unlocked', icon: Unlock, phase: 2 },
    ],
  },
  {
    key: 'contribute',
    items: [
      { key: 'publications', href: '/dashboard/publications', icon: Megaphone, phase: 2 },
      { key: 'publish', href: '/dashboard/publish', icon: SquarePlus, phase: 2 },
    ],
  },
  {
    key: 'finances',
    items: [
      { key: 'wallet', href: '/dashboard/wallet', icon: Wallet, phase: 3 },
      { key: 'commissions', href: '/dashboard/commissions', icon: HandCoins, phase: 3 },
      { key: 'withdrawals', href: '/dashboard/withdrawals', icon: ArrowDownToLine, phase: 3 },
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
  { key: 'offers', href: '/dashboard/jobs', icon: Search },
  { key: 'publish', href: '/dashboard/publish', icon: SquarePlus },
  { key: 'studio', href: '/dashboard/studio', icon: Sparkles },
  { key: 'account', href: '/dashboard/settings', icon: UserRound },
];

/** Rubrique active : la vue d'ensemble seulement sur sa propre adresse, les autres par préfixe. */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}
