import { type CareerExportFilter, type CvTemplate } from '@opportinities/shared';
import { ArrowRight, Files, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { SegmentedLinks } from '@/features/admin/segmented-links';
import { JobPagination } from '@/features/jobs/pagination';
import { firstParam, pageParam, type SearchParams } from '@/features/jobs/routes';
import { TYPE_ICONS } from '@/features/studio/document-icons';
import { ExportDownloadButton } from '@/features/studio/download-button';
import { PackButton } from '@/features/studio/pack-dialog';
import { getCareerExports } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

const BASE = '/dashboard/documents';

const PAYMENT_TONE: Record<'paid' | 'pack' | 'included', BadgeTone> = {
  paid: 'success',
  pack: 'primary',
  included: 'neutral',
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.app.nav');
  return { title: t('documents') };
}

/** Mes documents : historique des PDF exportés, toujours téléchargeables. */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser();
  const params = await searchParams;
  const type = firstParam(params.type);
  const filter: CareerExportFilter | null = type === 'cv' || type === 'letter' ? type : null;
  const page = pageParam(params);
  const [t, tRoot, format, history] = await Promise.all([
    getTranslations('studio.documents'),
    getTranslations(),
    getFormatter(),
    getCareerExports(filter, page),
  ]);
  const href = (target: number, value: CareerExportFilter | null = filter) => {
    const query = new URLSearchParams();
    if (value) query.set('type', value);
    if (target > 1) query.set('page', String(target));
    const text = query.toString();
    return text ? `${BASE}?${text}` : BASE;
  };
  const size = (bytes: number) =>
    t('size', { size: format.number(Math.max(1, Math.round(bytes / 1024))) });

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            {tRoot('common.app.nav.documents')}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{t('intro')}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:flex-nowrap">
          <PackButton />
          <ButtonLink href="/dashboard/studio" icon={Sparkles}>
            {t('toStudio')}
          </ButtonLink>
        </div>
      </div>

      <div>
        <SegmentedLinks
          label={t('filter')}
          current={filter ?? 'all'}
          options={[
            { value: 'all', label: t('filters.all'), href: href(1, null) },
            { value: 'cv', label: t('filters.cv'), href: href(1, 'cv') },
            { value: 'letter', label: t('filters.letter'), href: href(1, 'letter') },
          ]}
        />
      </div>

      {history === null ? (
        <Alert tone="error">{tRoot('errors.SERVICE_UNAVAILABLE')}</Alert>
      ) : history.items.length === 0 ? (
        <EmptyState
          icon={Files}
          title={t('empty')}
          description={t('emptyBody')}
          className="bg-surface py-14"
          action={
            <ButtonLink href="/dashboard/studio" icon={Sparkles}>
              {t('toStudio')}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="stagger grid gap-3">
          {history.items.map((item) => {
            const Icon = TYPE_ICONS[item.type];
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs sm:flex-row sm:items-center"
              >
                <span className="hidden size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand sm:grid">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-fg">{item.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{tRoot(`studio.list.types.${item.type}`)}</Badge>
                    <Badge tone={PAYMENT_TONE[item.payment]}>{t(`payment.${item.payment}`)}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm text-fg-muted sm:text-[13px]">
                    {[
                      format.dateTime(new Date(item.createdAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                      tRoot(`studio.editor.templates.${item.templateKey as CvTemplate}`),
                      tRoot(`studio.list.languages.${item.language}`),
                      item.sizeBytes === null ? null : size(item.sizeBytes),
                      item.editable ? null : t('deleted'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.editable && (
                    <ButtonLink
                      href={`/dashboard/studio/${item.documentId}`}
                      variant="ghost"
                      trailingIcon={ArrowRight}
                    >
                      {t('edit')}
                    </ButtonLink>
                  )}
                  <ExportDownloadButton exportId={item.id} title={item.title} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {history && (
        <JobPagination
          page={page}
          pages={Math.ceil(history.total / history.pageSize)}
          href={(target) => href(target)}
        />
      )}
    </div>
  );
}
