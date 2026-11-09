import { getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';

/** Page légale en attente de rédaction et de validation juridique (décision D13). */
export async function LegalPage({ titleKey }: { titleKey: 'termsTitle' | 'privacyTitle' }) {
  const t = await getTranslations('common.legal');
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t(titleKey)}</h1>
      <Alert tone="info" className="mt-8">
        <p>{t('pending')}</p>
      </Alert>
    </section>
  );
}
