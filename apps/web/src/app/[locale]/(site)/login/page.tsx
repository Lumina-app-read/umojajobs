import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/layout/auth-shell';
import { LoginForm } from '@/features/auth/login-form';
import { Link } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login');
  return { title: t('title'), robots: { index: false } };
}

export default async function LoginPage() {
  const t = await getTranslations('auth.login');
  return (
    <AuthShell
      visual="login"
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link
            href="/register"
            className="font-medium text-brand underline-offset-2 hover:underline"
          >
            {t('registerLink')}
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
