import { Archive, ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { getJobArchives } from '@/lib/api/server';
import { JobCard } from './job-card';
import { JobPagination } from './pagination';
import { type JobsBase, pageParam, type SearchParams } from './routes';

/** Archives : offres expirées, consultables mais non déverrouillables. */
export async function JobArchivesView({ base, params }: { base: JobsBase; params: SearchParams }) {
  const t = await getTranslations('jobs.public');
  const page = pageParam(params);
  const result = await getJobArchives(page);
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const inApp = base === '/dashboard/jobs';

  return (
    <div className="grid gap-6">
      <div>
        <ButtonLink href={base} variant="ghost" size="sm" icon={ArrowLeft}>
          {t('detail.back')}
        </ButtonLink>
        <h1
          className={
            inApp
              ? 'mt-3 text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]'
              : 'mt-3 text-[28px] leading-9 font-bold tracking-[-0.02em] text-fg sm:text-display-lg'
          }
        >
          {t('archivesTitle')}
        </h1>
        <p className={inApp ? 'mt-1.5 text-sm text-fg-muted' : 'mt-2 text-base text-fg-muted'}>
          {t('archivesIntro')}
        </p>
      </div>

      {result === null ? (
        <Alert tone="error">{t('unavailable')}</Alert>
      ) : result.items.length === 0 ? (
        <EmptyState icon={Archive} title={t('archivesEmpty')} className="bg-surface py-16" />
      ) : (
        <>
          <div className="stagger grid gap-4 md:grid-cols-2">
            {result.items.map((offer) => (
              <JobCard key={offer.id} offer={offer} base={base} />
            ))}
          </div>
          <JobPagination
            page={page}
            pages={pages}
            href={(target) => `${base}/archives?page=${target}`}
          />
        </>
      )}
    </div>
  );
}
