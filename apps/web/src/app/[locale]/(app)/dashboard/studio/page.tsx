import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { StudioDocuments } from '@/features/studio/document-list';
import { getCareerDocuments } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('studio.list');
  return { title: t('title') };
}

/** Career Studio : documents de l'utilisateur et création d'un nouveau document. */
export default async function StudioPage() {
  await requireUser();
  const [t, tErrors, documents] = await Promise.all([
    getTranslations('studio.list'),
    getTranslations('errors'),
    getCareerDocuments(),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          {t('title')}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{t('intro')}</p>
      </div>
      {documents === null ? (
        <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>
      ) : (
        <StudioDocuments documents={documents} />
      )}
    </div>
  );
}
