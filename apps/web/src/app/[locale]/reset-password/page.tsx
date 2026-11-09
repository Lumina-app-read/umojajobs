import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthCard } from '@/components/ui/card';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.resetPassword');
  return { title: t('title'), robots: { index: false } };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations('auth.resetPassword');
  return (
    <AuthCard title={t('title')} subtitle={t('subtitle')}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
