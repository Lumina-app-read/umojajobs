import { LayoutDashboard, LogIn, UserPlus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { ThemeMenu } from '@/components/theme/theme-menu';
import { ButtonLink } from '@/components/ui/button-link';
import { LogoutButton } from '@/features/auth/logout-button';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/api/server';
import { LanguageMenu } from './language-menu';
import { Logo } from './logo';
import { MobileNav } from './mobile-nav';
import { PRIMARY_NAV } from './nav-items';

const SESSION_COOKIES = ['oppo_session', '__Host-oppo_session'];

/** Session complète en cours ? L'API n'est interrogée que si un cookie de session est présent. */
async function isSignedIn(): Promise<boolean> {
  const cookieStore = await cookies();
  if (!SESSION_COOKIES.some((name) => cookieStore.has(name))) return false;
  const result = await getCurrentUser().catch(() => null);
  return Boolean(result?.data && !result.data.mfaState.endsWith('_required'));
}

/**
 * En-tête du site public. À partir de 1024 px : marque, navigation, langue, thème et compte.
 * En dessous : marque, thème, inscription et un tiroir qui regroupe le reste.
 * La marque est le logo seul (pas de nom écrit), dont la couleur suit le thème.
 */
export async function SiteHeader() {
  const t = await getTranslations('common.nav');
  const signedIn = await isSignedIn();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="-ml-1 rounded-md p-1" aria-label={t('homeLabel')}>
          <Logo />
        </Link>

        <nav aria-label={t('main')} className="ml-6 max-lg:hidden">
          <ul className="flex items-center gap-1">
            {PRIMARY_NAV.map(({ key, hash }) => (
              <li key={key}>
                <Link
                  href={{ pathname: '/', hash }}
                  className="rounded-md px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  {t(key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <LanguageMenu className="max-lg:hidden" />
          <ThemeMenu />
          <span className="mx-1.5 h-5 w-px bg-line max-lg:hidden" aria-hidden="true" />
          {signedIn ? (
            <div className="flex items-center gap-2 max-lg:hidden">
              <ButtonLink href="/dashboard" variant="ghost" icon={LayoutDashboard}>
                {t('dashboard')}
              </ButtonLink>
              <LogoutButton />
            </div>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" icon={LogIn} className="max-lg:hidden">
                {t('login')}
              </ButtonLink>
              <ButtonLink
                href="/register"
                icon={UserPlus}
                className="ml-1 max-sm:h-8 max-sm:gap-1.5 max-sm:px-3 max-sm:text-[13px]"
              >
                {t('register')}
              </ButtonLink>
            </>
          )}
          <MobileNav signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}
