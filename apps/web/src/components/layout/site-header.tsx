import { LayoutDashboard } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { ThemeMenu } from '@/components/theme/theme-menu';
import { buttonClasses } from '@/components/ui/button';
import { LogoutButton } from '@/features/auth/logout-button';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/api/server';
import { cn } from '@/lib/cn';
import { LanguageMenu } from './language-menu';
import { Logo } from './logo';

const SESSION_COOKIES = ['oppo_session', '__Host-oppo_session'];

/** Session complète en cours ? L'API n'est interrogée que si un cookie de session est présent. */
async function isSignedIn(): Promise<boolean> {
  const cookieStore = await cookies();
  if (!SESSION_COOKIES.some((name) => cookieStore.has(name))) return false;
  const result = await getCurrentUser().catch(() => null);
  return Boolean(result?.data && !result.data.mfaState.endsWith('_required'));
}

/**
 * En-tête provisoire (étape D1) : un menu de langue et un menu de thème uniques.
 * La navigation produit complète et le menu mobile arrivent à l'étape D2.
 */
export async function SiteHeader() {
  const t = await getTranslations('common.nav');
  const signedIn = await isSignedIn();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="mr-auto rounded-md" aria-label={t('home')}>
          <Logo />
        </Link>
        <nav aria-label={t('main')} className="flex items-center gap-0.5 sm:gap-1">
          <LanguageMenu />
          <ThemeMenu />
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
          {signedIn ? (
            <>
              <Link href="/dashboard" className={cn(buttonClasses('ghost', 'md'), 'max-sm:hidden')}>
                <LayoutDashboard className="size-4" aria-hidden="true" />
                {t('dashboard')}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className={cn(buttonClasses('ghost', 'md'), 'max-sm:hidden')}>
                {t('login')}
              </Link>
              <Link
                href="/register"
                className={cn(
                  buttonClasses('primary', 'md'),
                  'max-sm:h-8 max-sm:px-3 max-sm:text-[13px]',
                )}
              >
                {t('register')}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
