import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { KeyRound } from 'lucide-react';
import { AuthCard } from '@/components/ui/card';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';
import { Link } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.forgotPassword');
  return { title: t('title'), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth.forgotPassword');
  return (
    <AuthCard
      icon={KeyRound}
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <Link href="/login" className="font-medium text-brand underline-offset-2 hover:underline">
          {t('backToLogin')}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
