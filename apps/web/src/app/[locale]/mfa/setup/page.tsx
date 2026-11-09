import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthCard } from '@/components/ui/card';
import { MfaSetup } from '@/features/auth/mfa-setup';
import { requireMfaStep } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.mfa');
  return { title: t('setupTitle'), robots: { index: false } };
}

export default async function MfaSetupPage() {
  await requireMfaStep('/mfa/setup');
  const t = await getTranslations('auth.mfa');
  return (
    <AuthCard title={t('setupTitle')}>
      <MfaSetup />
    </AuthCard>
  );
}
