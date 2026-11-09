import { RefreshCw } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/layout/auth-shell';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { RegisterForm } from '@/features/auth/register-form';
import { Link } from '@/i18n/navigation';
import { getCountries } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.register');
  return { title: t('title'), robots: { index: false } };
}

export default async function RegisterPage() {
  const t = await getTranslations('auth.register');
  const tErrors = await getTranslations('errors');
  const tActions = await getTranslations('common.actions');
  // Pays actifs du référentiel (administrable) : un pays désactivé n'est plus proposé.
  // Si l'API ne répond pas, un message clair remplace le formulaire (pas de page d'erreur 500).
  const countries = await getCountries().catch(() => null);
  return (
    <AuthShell
      visual="register"
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-medium text-brand underline-offset-2 hover:underline">
            {t('loginLink')}
          </Link>
        </>
      }
    >
      {countries ? (
        <RegisterForm countries={countries} />
      ) : (
        <div className="grid gap-4">
          <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>
          <ButtonLink href="/register" variant="secondary" icon={RefreshCw}>
            {tActions('retry')}
          </ButtonLink>
        </div>
      )}
    </AuthShell>
  );
}
