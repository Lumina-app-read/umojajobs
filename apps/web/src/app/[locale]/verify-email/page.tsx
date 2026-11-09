import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthCard } from '@/components/ui/card';
import { VerifyEmailView } from '@/features/auth/verify-email-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.verifyEmail');
  return { title: t('title'), robots: { index: false } };
}

export default async function VerifyEmailPage() {
  const t = await getTranslations('auth.verifyEmail');
  return (
    <AuthCard title={t('title')}>
      <VerifyEmailView />
    </AuthCard>
  );
}
