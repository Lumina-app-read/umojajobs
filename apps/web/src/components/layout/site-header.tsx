import { APP_NAME } from '@opportinities/shared';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { buttonClasses } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/theme/theme-switcher';
import { LogoutButton } from '@/features/auth/logout-button';
import { Link } from '@/i18n/navigation';
import { getCurrentUser } from '@/lib/api/server';
import { LanguageSwitcher } from './language-switcher';

const SESSION_COOKIES = ['oppo_session', '__Host-oppo_session'];

/** Session complète en cours ? L'API n'est interrogée que si un cookie de session est présent. */
async function isSignedIn(): Promise<boolean> {
  const cookieStore = await cookies();
  if (!SESSION_COOKIES.some((name) => cookieStore.has(name))) return false;
  const result = await getCurrentUser().catch(() => null);
  return Boolean(result?.data && !result.data.mfaState.endsWith('_required'));
}

export async function SiteHeader() {
  const t = await getTranslations('common.nav');
  const signedIn = await isSignedIn();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-brand-dark">
          {APP_NAME}
        </Link>
        <nav aria-label={t('main')} className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
          {signedIn ? (
            <>
              <Link href="/dashboard" className={buttonClasses('ghost')}>
                {t('dashboard')}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClasses('ghost')}>
                {t('login')}
              </Link>
              <Link href="/register" className={buttonClasses('primary')}>
                {t('register')}
              </Link>
            </>
          )}
        </nav>
      </div>
      {/* Sur mobile, les sélecteurs passent sous la barre principale. */}
      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2 sm:hidden">
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>
    </header>
  );
}
