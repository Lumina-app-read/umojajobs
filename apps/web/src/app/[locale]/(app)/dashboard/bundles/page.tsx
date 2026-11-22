import { ArrowRight, FileStack, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { CreateBundleButton } from '@/features/bundles/create-bundle';
import { getBundles } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.app.nav');
  return { title: t('bundles') };
}

/** Dossiers rassemblés : fichiers de l'utilisateur réunis en un seul PDF. */
export default async function BundlesPage() {
  await requireUser();
  const [t, tRoot, format, bundles] = await Promise.all([
    getTranslations('bundles'),
    getTranslations(),
    getFormatter(),
    getBundles(),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            {t('title')}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{t('intro')}</p>
        </div>
        {bundles && bundles.length > 0 && <CreateBundleButton />}
      </div>

      {bundles === null ? (
        <Alert tone="error">{tRoot('errors.SERVICE_UNAVAILABLE')}</Alert>
      ) : bundles.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title={t('empty')}
          description={t('emptyBody')}
          className="bg-surface py-14"
          action={<CreateBundleButton />}
        />
      ) : (
        <ul className="stagger grid gap-3">
          {bundles.map((bundle) => (
            <li
              key={bundle.id}
              className="lift flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs sm:flex-row sm:items-center"
            >
              <span className="hidden size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand sm:grid">
                <FileStack className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-fg">{bundle.title}</p>
                <p className="mt-1 text-sm text-fg-muted sm:text-[13px]">
                  {[
                    t('files', { count: bundle.fileCount }),
                    t('pages', { count: bundle.pageCount }),
                    format.dateTime(new Date(bundle.updatedAt), { dateStyle: 'medium' }),
                  ].join(' · ')}
                </p>
              </div>
              <ButtonLink
                href={`/dashboard/bundles/${bundle.id}`}
                variant="secondary"
                trailingIcon={ArrowRight}
              >
                {t('open')}
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-start gap-2 text-sm text-fg-subtle sm:text-[13px]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t('privacy')}
      </p>
    </div>
  );
}
