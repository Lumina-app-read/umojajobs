'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { Bell, Globe, Menu, X } from 'lucide-react';
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
import { APP_NAV_ITEMS, APP_TABS, isActive } from './app-nav';
import { AppNavList } from './app-nav-list';

export interface ShellUser {
  firstName: string;
  lastName: string;
  email: string;
}

const DESKTOP_QUERY = '(min-width: 1024px)';
const iconButton = cn(buttonClasses('ghost', 'md'), 'size-9 px-0');

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

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('common.nav');
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      className="-ml-1 rounded-md p-1"
      aria-label={t('dashboard')}
    >
      <Logo size={30} />
    </Link>
  );
}

/** Tiroir de navigation (mobile et tablette). */
function AppDrawer({ user }: { user: ShellUser }) {
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
              <Brand onNavigate={close} />
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
              <AppNavList onNavigate={close} />
            </div>
            <UserBlock user={user} />
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}

/** Barre d'onglets en bas de l'écran (mobile) : cinq destinations fréquentes. */
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
 * tiroir et barre d'onglets (mobile). Le contenu de chaque page est rendu dans <main>.
 */
export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const current = APP_NAV_ITEMS.find((item) => isActive(pathname, item.href));

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <AppNavList dense />
        </div>
        <UserBlock user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md backdrop-saturate-150">
          <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
            <AppDrawer user={user} />
            <div className="lg:hidden">
              <Brand />
            </div>
            <p className="truncate text-sm font-semibold text-fg max-lg:hidden">
              {current ? t(`app.nav.${current.key}`) : null}
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

        <main id="main" className="flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      <AppTabBar />
    </div>
  );
}
