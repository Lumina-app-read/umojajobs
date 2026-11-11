'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { type Locale, PERMISSIONS, type ThemePreference } from '@opportinities/shared';
import { ArrowLeft, Bell, Globe, Menu, ShieldCheck, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';
import { LanguageMenu } from '@/components/layout/language-menu';
import { Logo } from '@/components/layout/logo';
import { ThemeMenu } from '@/components/theme/theme-menu';
import { buttonClasses } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Avatar } from '@/components/ui/feedback';
import { LogoutButton } from '@/features/auth/logout-button';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { visibleAdminNav } from './admin-nav';
import { APP_NAV, APP_TABS, isActive } from './app-nav';
import { AppNavList, type NavGroupView } from './app-nav-list';
import { PreferenceSync } from './preference-sync';

export interface ShellUser {
  firstName: string;
  lastName: string;
  email: string;
  theme: ThemePreference;
  locale: Locale;
  permissions: string[];
}

/** Espace affiché : personnel (`user`) ou administration (`admin`). */
export type ShellVariant = 'user' | 'admin';

const DESKTOP_QUERY = '(min-width: 1024px)';
const iconButton = cn(buttonClasses('ghost', 'md'), 'size-9 px-0');

/** Navigation traduite de l'espace demandé, limitée aux permissions de l'utilisateur. */
function useNavGroups(variant: ShellVariant, permissions: string[]): NavGroupView[] {
  const t = useTranslations('common');

  if (variant === 'admin') {
    const groups: NavGroupView[] = visibleAdminNav(permissions).map((group) => ({
      key: group.key,
      label: group.key === 'main' ? null : t(`admin.nav.groups.${group.key}`),
      items: group.items.map((item) => ({ ...item, label: t(`admin.nav.${item.key}`) })),
    }));
    groups.push({
      key: 'back',
      label: null,
      items: [{ key: 'back', href: '/dashboard', icon: ArrowLeft, label: t('admin.nav.back') }],
    });
    return groups;
  }

  const groups: NavGroupView[] = APP_NAV.map((group) => ({
    key: group.key,
    label: group.key === 'main' ? null : t(`app.nav.groups.${group.key}`),
    items: group.items.map((item) => ({ ...item, label: t(`app.nav.${item.key}`) })),
  }));
  if (permissions.includes(PERMISSIONS.ADMIN_ACCESS)) {
    groups.push({
      key: 'admin',
      label: null,
      items: [{ key: 'admin', href: '/admin', icon: ShieldCheck, label: t('admin.nav.enter') }],
    });
  }
  return groups;
}

/** Bloc utilisateur (bas de la barre latérale et du tiroir) : identité et déconnexion. */
function UserBlock({ user }: { user: ShellUser }) {
  const fullName = `${user.firstName} ${user.lastName}`;
  return (
    <div className="grid gap-3 border-t border-line p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={fullName} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{fullName}</p>
          <p className="truncate text-xs text-fg-muted">{user.email}</p>
        </div>
      </div>
      <LogoutButton className="w-full" />
    </div>
  );
}

function Brand({ variant, onNavigate }: { variant: ShellVariant; onNavigate?: () => void }) {
  const t = useTranslations('common');
  const admin = variant === 'admin';
  return (
    <Link
      href={admin ? '/admin' : '/dashboard'}
      onClick={onNavigate}
      className="-ml-1 flex items-center gap-2 rounded-md p-1"
      aria-label={admin ? t('admin.nav.enter') : t('nav.dashboard')}
    >
      <Logo size={30} />
      {admin && (
        <span className="rounded-md bg-navy px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
          {t('admin.badge')}
        </span>
      )}
    </Link>
  );
}

/** Tiroir de navigation (mobile et tablette). */
function AppDrawer({
  user,
  variant,
  groups,
  label,
}: {
  user: ShellUser;
  variant: ShellVariant;
  groups: NavGroupView[];
  label: string;
}) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const media = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => media.matches && setOpen(false);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(iconButton, '-ml-2 lg:hidden')}
        aria-label={t('nav.openMenu')}
        aria-expanded={open}
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <Dialog open={open} onClose={close} className="relative z-50 lg:hidden">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-navy/40 backdrop-blur-[2px] transition duration-200 data-closed:opacity-0"
        />
        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            className="flex h-full w-full max-w-72 flex-col border-r border-line bg-surface-raised shadow-lg transition duration-[320ms] ease-emphasized data-closed:-translate-x-full"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
              <DialogTitle className="sr-only">{t('nav.menu')}</DialogTitle>
              <Brand variant={variant} onNavigate={close} />
              <button
                type="button"
                onClick={close}
                className={iconButton}
                aria-label={t('nav.closeMenu')}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <AppNavList groups={groups} label={label} onNavigate={close} />
            </div>
            <UserBlock user={user} />
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}

/** Barre d'onglets en bas de l'écran (mobile, espace personnel) : cinq destinations fréquentes. */
function AppTabBar() {
  const t = useTranslations('common.app');
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('nav.label')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {APP_TABS.map(({ key, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  active ? 'text-brand' : 'text-fg-subtle hover:text-fg',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {t(`tabs.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Structure de l'espace connecté : barre latérale de 256 px (ordinateur), barre supérieure,
 * tiroir et, dans l'espace personnel, barre d'onglets (mobile). Le contenu est rendu dans <main>.
 */
export function AppShell({
  user,
  variant = 'user',
  children,
}: {
  user: ShellUser;
  variant?: ShellVariant;
  children: ReactNode;
}) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const groups = useNavGroups(variant, user.permissions);
  const navLabel = variant === 'admin' ? t('admin.nav.label') : t('app.nav.label');
  const current = groups
    .flatMap((group) => group.items)
    .find((item) => isActive(pathname, item.href));

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Brand variant={variant} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <AppNavList groups={groups} label={navLabel} dense />
        </div>
        <UserBlock user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="header-elevate sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md backdrop-saturate-150">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
            <AppDrawer user={user} variant={variant} groups={groups} label={navLabel} />
            <div className="lg:hidden">
              <Brand variant={variant} />
            </div>
            <p className="truncate text-sm font-semibold text-fg max-lg:hidden">
              {current?.label ?? null}
            </p>
            <div className="ml-auto flex items-center gap-1">
              <ButtonLink href="/" variant="ghost" icon={Globe} className="max-md:hidden">
                {t('app.publicSite')}
              </ButtonLink>
              <LanguageMenu className="max-sm:hidden" />
              <ThemeMenu />
              <Link
                href="/dashboard/notifications"
                className={iconButton}
                aria-label={t('app.nav.notifications')}
              >
                <Bell className="size-[18px]" aria-hidden="true" />
              </Link>
              <Link
                href="/dashboard/settings"
                className="ml-1 rounded-full"
                aria-label={t('app.user.account')}
              >
                <Avatar name={`${user.firstName} ${user.lastName}`} />
              </Link>
            </div>
          </div>
        </header>

        <main
          id="main"
          className={cn(
            'flex-1 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12',
            variant === 'user' ? 'pb-28' : 'pb-12',
          )}
        >
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {variant === 'user' && <AppTabBar />}
      <PreferenceSync theme={user.theme} locale={user.locale} />
    </div>
  );
}
