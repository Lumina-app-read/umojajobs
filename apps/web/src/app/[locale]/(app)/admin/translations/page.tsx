import { PERMISSIONS } from '@opportinities/shared';
import { CircleAlert, CircleCheck, Languages, RotateCcw, Search } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import {
  searchTranslations,
  summarize,
  TRANSLATION_RESULT_LIMIT,
  translationRows,
} from '@/features/admin/translation-index';
import { firstParam, type SearchParams } from '@/features/jobs/routes';
import { RegistrySearchField } from '@/features/registry/registry-search';
import { Link } from '@/i18n/navigation';
import { hasPermission, requirePermission } from '@/lib/auth-guard';
import { cn } from '@/lib/cn';

const BASE = '/admin/translations';

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.SETTINGS_MANAGE))) return {};
  const t = await getTranslations('common.admin.translations');
  return { title: t('title') };
}

/**
 * Traductions : consultation de tous les textes FR et EN (interface et emails), couverture par
 * espace et textes manquants. Lecture seule : les textes vivent dans le code et sont déployés.
 */
export default async function TranslationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const params = await searchParams;
  const [t, format] = await Promise.all([
    getTranslations('common.admin.translations'),
    getFormatter(),
  ]);
  const rows = translationRows();
  const summaries = summarize(rows);
  const rawNamespace = firstParam(params.ns);
  const namespace = summaries.find((summary) => summary.namespace === rawNamespace)?.namespace;
  const q = (firstParam(params.q) ?? '').trim().slice(0, 120);
  const missing = firstParam(params.missing) === '1';
  const searching = Boolean(q || namespace || missing);
  const results = searching ? searchTranslations(rows, { q, namespace, missing }) : [];
  const shown = results.slice(0, TRANSLATION_RESULT_LIMIT);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          <Languages className="size-6 text-brand" aria-hidden="true" />
          {t('title')}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{t('intro')}</p>
      </div>

      <section aria-labelledby="translation-coverage" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="translation-coverage" className="text-base font-semibold text-fg">
            {t('namespaces')}
          </h2>
          <p className="text-xs text-fg-subtle">
            {t('totalKeys', { count: format.number(rows.length) })}
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => {
            const complete = summary.missingFr === 0 && summary.missingEn === 0;
            return (
              <li key={summary.namespace}>
                <Link
                  href={`${BASE}?ns=${summary.namespace}`}
                  aria-current={summary.namespace === namespace ? 'page' : undefined}
                  className={cn(
                    'lift flex items-center gap-3 rounded-lg border bg-surface px-3.5 py-3 shadow-xs',
                    summary.namespace === namespace
                      ? 'border-primary'
                      : 'border-line hover:border-line-strong',
                  )}
                >
                  {complete ? (
                    <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <CircleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">
                      {t(`names.${summary.namespace}`)}
                    </span>
                    <span className="block font-mono text-xs text-fg-subtle">
                      {summary.namespace}
                    </span>
                  </span>
                  <span className="text-right text-xs text-fg-muted tabular-nums">
                    {format.number(summary.keys)} {t('keys').toLowerCase()}
                    {!complete && (
                      <span className="block text-warning">
                        {summary.missingFr > 0 && `${t('missingFr')} ${summary.missingFr} `}
                        {summary.missingEn > 0 && `${t('missingEn')} ${summary.missingEn}`}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <form method="get" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {namespace && <input type="hidden" name="ns" value={namespace} />}
        <RegistrySearchField
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          defaultValue={q}
        />
        <label className="flex h-11 items-center gap-2 text-sm text-fg-muted sm:h-10">
          <input
            type="checkbox"
            name="missing"
            value="1"
            defaultChecked={missing}
            className="size-4 accent-[var(--primary)]"
          />
          {t('missingOnly')}
        </label>
        <Button type="submit" variant="secondary" size="lg" icon={Search}>
          {t('search')}
        </Button>
        {searching && (
          <ButtonLink href={BASE} variant="ghost" size="lg" icon={RotateCcw}>
            {t('allNamespaces')}
          </ButtonLink>
        )}
      </form>

      {searching &&
        (results.length === 0 ? (
          <EmptyState
            icon={Search}
            title={t('empty')}
            description={t('emptyBody')}
            className="bg-surface py-14"
          />
        ) : (
          <section aria-labelledby="translation-results" className="grid gap-3">
            <h2 id="translation-results" className="text-sm font-semibold text-fg">
              {t('results', { count: results.length })}
            </h2>
            {results.length > shown.length && (
              <Alert tone="info">{t('truncated', { limit: TRANSLATION_RESULT_LIMIT })}</Alert>
            )}
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
              {shown.map((row) => (
                <li key={`${row.namespace}.${row.key}`} className="grid gap-2 px-4 py-3">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{row.namespace}</Badge>
                    <span className="font-mono text-xs break-all text-fg-muted">{row.key}</span>
                  </p>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-xs text-fg-subtle">{t('french')}</dt>
                      <dd lang="fr" className="break-words text-fg">
                        {row.fr ?? <Badge tone="warning">{t('missing')}</Badge>}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-fg-subtle">{t('english')}</dt>
                      <dd lang="en" className="break-words text-fg">
                        {row.en ?? <Badge tone="warning">{t('missing')}</Badge>}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}
