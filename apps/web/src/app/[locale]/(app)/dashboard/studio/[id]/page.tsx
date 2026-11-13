import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { type CvLabels } from '@/features/studio/cv-format';
import { CvEditor } from '@/features/studio/cv-editor';
import { cvLabels } from '@/features/studio/cv-labels';
import { getCareerDocument, getCountries } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

const UUID = /^[0-9a-f-]{36}$/i;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const document = UUID.test(id) ? await getCareerDocument(id) : null;
  const t = await getTranslations('studio.list');
  return { title: document?.title ?? t('title') };
}

async function bothLabels(): Promise<Record<'fr' | 'en', CvLabels>> {
  const [fr, en] = await Promise.all([cvLabels('fr'), cvLabels('en')]);
  return { fr, en };
}

/** Éditeur d'un document du Career Studio. */
export default async function StudioDocumentPage({ params }: { params: Params }) {
  await requireUser();
  const { id } = await params;
  const [document, countries, labels, tErrors] = await Promise.all([
    UUID.test(id) ? getCareerDocument(id) : Promise.resolve(null),
    getCountries().catch(() => null),
    bothLabels(),
    getTranslations('errors'),
  ]);
  if (!document) notFound();
  if (!countries) return <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>;
  return <CvEditor document={document} countries={countries} labels={labels} />;
}
