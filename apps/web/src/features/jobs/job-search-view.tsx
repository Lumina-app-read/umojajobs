import {
  CONTRACT_TYPES,
  type ContractType,
  WORK_MODES,
  type WorkMode,
} from '@opportinities/shared';
import { Archive, SearchX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { getCountries, getJobCategories, searchJobs } from '@/lib/api/server';
import { JobCard } from './job-card';
import { type JobFilterValues, JobFilters } from './job-filters';
import { JobPagination } from './pagination';
import { firstParam, type JobsBase, pageParam, type SearchParams } from './routes';

const isContract = (value: unknown): value is ContractType =>
  (CONTRACT_TYPES as readonly unknown[]).includes(value);
const isWorkMode = (value: unknown): value is WorkMode =>
  (WORK_MODES as readonly unknown[]).includes(value);

/** Filtres lus dans l'adresse, validés avant d'être transmis à l'API. */
function readFilters(params: SearchParams): JobFilterValues {
  const contractType = firstParam(params.contractType);
  const workMode = firstParam(params.workMode);
  return {
    q: (firstParam(params.q) ?? '').slice(0, 120),
    country: firstParam(params.country)?.toUpperCase().slice(0, 2) || null,
    category: firstParam(params.category) || null,
    contractType: isContract(contractType) ? contractType : null,
    workMode: isWorkMode(workMode) ? workMode : null,
    sort: firstParam(params.sort) === 'deadline' ? 'deadline' : 'recent',
  };
}

/** Liste des offres vérifiées : en-tête, filtres, résultats et pagination. */
export async function JobSearchView({ base, params }: { base: JobsBase; params: SearchParams }) {
  const t = await getTranslations('jobs.public');
  const filters = readFilters(params);
  const page = pageParam(params);

  const query = new URLSearchParams({ page: String(page), pageSize: '20' });
  if (filters.q) query.set('q', filters.q);
  if (filters.country) query.set('country', filters.country);
  if (filters.category) query.set('category', filters.category);
  if (filters.contractType) query.set('contractType', filters.contractType);
  if (filters.workMode) query.set('workMode', filters.workMode);
  if (filters.sort !== 'recent') query.set('sort', filters.sort);

  const [result, countries, categories] = await Promise.all([
    searchJobs(query.toString()),
    getCountries().catch(() => []),
    getJobCategories(),
  ]);
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const pageHref = (target: number) => {
    const next = new URLSearchParams(query);
    next.delete('pageSize');
    next.set('page', String(target));
    return `${base}?${next.toString()}`;
  };
  const inApp = base === '/dashboard/jobs';

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className={
              inApp
                ? 'text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]'
                : 'text-[28px] leading-9 font-bold tracking-[-0.02em] text-fg sm:text-display-lg'
            }
          >
            {t('title')}
          </h1>
          <p className={inApp ? 'mt-1.5 text-sm text-fg-muted' : 'mt-2 text-base text-fg-muted'}>
            {t('intro')}
          </p>
        </div>
        <ButtonLink href={`${base}/archives`} variant="ghost" icon={Archive}>
          {t('archives')}
        </ButtonLink>
      </div>

      <JobFilters base={base} initial={filters} countries={countries} categories={categories} />

      {result === null ? (
        <Alert tone="error">{t('unavailable')}</Alert>
      ) : result.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t('empty')}
          description={t('emptyBody')}
          className="bg-surface py-16"
        />
      ) : (
        <>
          <p className="text-sm font-medium text-fg-muted" role="status">
            {t('results', { count: result.total })}
          </p>
          <div className="stagger grid gap-4 md:grid-cols-2">
            {result.items.map((offer) => (
              <JobCard key={offer.id} offer={offer} base={base} />
            ))}
          </div>
          <JobPagination page={page} pages={pages} href={pageHref} />
        </>
      )}
    </div>
  );
}
