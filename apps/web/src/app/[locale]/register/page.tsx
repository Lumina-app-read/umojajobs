import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthCard } from '@/components/ui/card';
import { RegisterForm } from '@/features/auth/register-form';
import { Link } from '@/i18n/navigation';
import { getCountries } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.register');
  return { title: t('title'), robots: { index: false } };
}

export default async function RegisterPage() {
  const t = await getTranslations('auth.register');
  // Pays actifs du référentiel (administrable) : un pays désactivé n'est plus proposé.
  const countries = await getCountries();
  return (
    <AuthCard
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {t('loginLink')}
          </Link>
        </>
      }
    >
      <RegisterForm countries={countries} />
    </AuthCard>
  );
}
