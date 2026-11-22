import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { BundleEditor } from '@/features/bundles/bundle-editor';
import { getBundle } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

type Params = Promise<{ id: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.app.nav');
  return { title: t('bundles') };
}

/** Dossier rassemblé : ajout, ordre et export des fichiers. */
export default async function BundlePage({ params }: { params: Params }) {
  await requireUser();
  const bundle = await getBundle((await params).id);
  if (!bundle) notFound();
  return <BundleEditor initial={bundle} />;
}
