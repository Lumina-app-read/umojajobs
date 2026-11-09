import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthCard } from '@/components/ui/card';
import { MfaVerifyForm } from '@/features/auth/mfa-verify-form';
import { requireMfaStep } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.mfa');
  return { title: t('verifyTitle'), robots: { index: false } };
}

export default async function MfaVerifyPage() {
  await requireMfaStep('/mfa');
  const t = await getTranslations('auth.mfa');
  return (
    <AuthCard title={t('verifyTitle')} subtitle={t('verifySubtitle')}>
      <MfaVerifyForm />
    </AuthCard>
  );
}
