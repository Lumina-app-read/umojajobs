'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { LayoutDashboard, LogIn, Menu, UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { LogoutButton } from '@/features/auth/logout-button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { Logo } from './logo';
import { PRIMARY_NAV } from './nav-items';
import { PreferenceControls } from './preference-controls';

/** Largeur à partir de laquelle l'en-tête affiche toute la navigation (Tailwind `lg`). */
const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * Tiroir de navigation mobile (sous 1024 px) : liens principaux, langue, thème et compte.
 * Headless UI gère le piège du focus, l'Échap et le retour du focus au bouton d'ouverture.
 */
export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  // Referme le tiroir si la fenêtre passe en largeur ordinateur.
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
        className={cn(buttonClasses('ghost', 'md'), 'size-9 px-0 lg:hidden')}
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
        <div className="fixed inset-0 flex justify-end">
          <DialogPanel
            transition
            className="flex h-full w-full max-w-xs flex-col border-l border-line bg-surface-raised shadow-lg transition duration-[320ms] ease-emphasized data-closed:translate-x-full"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
              <DialogTitle className="sr-only">{t('nav.menu')}</DialogTitle>
              <Link href="/" onClick={close} className="rounded-md" aria-label={t('nav.homeLabel')}>
                <Logo size={28} />
              </Link>
              <button
                type="button"
                onClick={close}
                className={cn(buttonClasses('ghost', 'md'), 'size-9 px-0')}
                aria-label={t('nav.closeMenu')}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <nav aria-label={t('nav.main')}>
                <ul className="grid gap-0.5">
                  {PRIMARY_NAV.map(({ key, href, icon: Icon }) => (
                    <li key={key}>
                      <Link
                        href={href}
                        onClick={close}
                        className="flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-fg transition-colors hover:bg-surface-2"
                      >
                        <Icon className="size-[18px] text-fg-subtle" aria-hidden="true" />
                        {t(`nav.${key}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <section className="mt-6 grid gap-4 border-t border-line px-3 pt-5">
                <h2 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                  {t('nav.preferences')}
                </h2>
                <PreferenceControls />
              </section>
            </div>

            <div className="grid shrink-0 gap-2 border-t border-line p-4">
              {signedIn ? (
                <>
                  <ButtonLink
                    href="/dashboard"
                    onClick={close}
                    size="lg"
                    fullWidth
                    icon={LayoutDashboard}
                  >
                    {t('nav.dashboard')}
                  </ButtonLink>
                  <LogoutButton className="h-10 w-full" />
                </>
              ) : (
                <>
                  <ButtonLink href="/register" onClick={close} size="lg" fullWidth icon={UserPlus}>
                    {t('nav.register')}
                  </ButtonLink>
                  <ButtonLink
                    href="/login"
                    onClick={close}
                    variant="secondary"
                    size="lg"
                    fullWidth
                    icon={LogIn}
                  >
                    {t('nav.login')}
                  </ButtonLink>
                </>
              )}
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}
