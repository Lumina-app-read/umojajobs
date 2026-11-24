import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LegalPage } from '@/components/layout/legal-page';
import { publicPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const t = await getTranslations('common.legal');
  const meta = await getTranslations('common.meta');
  return publicPageMetadata({
    locale: (await params).locale,
    path: '/terms',
    title: t('termsTitle'),
    description: meta('description'),
  });
}

export default function TermsPage() {
  return <LegalPage titleKey="termsTitle" />;
}
