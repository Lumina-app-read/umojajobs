import { AUDIT_RESULTS, type AuditResult, PERMISSIONS } from '@opportinities/shared';
import { ChevronRight, FileClock, RotateCcw } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { firstParam, type SearchParams } from '@/features/jobs/routes';
import { RegistrySearchField } from '@/features/registry/registry-search';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { getAuditLogs } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';
import { cn } from '@/lib/cn';

const TONE: Record<AuditResult, BadgeTone> = {
  success: 'success',
  denied: 'danger',
  rejected: 'warning',
  error: 'danger',
};
const UUID = /^[0-9a-f-]{36}$/i;
const BASE = '/admin/audit-logs';

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.AUDIT_LOGS_READ))) return {};
  const t = await getTranslations('registry.audit');
  return { title: t('title') };
}

/** Journal d'audit des actions d'administration : lecture seule, inaltérable. */
export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission(PERMISSIONS.AUDIT_LOGS_READ);
  const params = await searchParams;
  const raw = firstParam(params.result);
  const result = AUDIT_RESULTS.find((value) => value === raw);
  const actor = (firstParam(params.actor) ?? '').trim().slice(0, 120);
  const before = firstParam(params.before);
  const [t, tErrors, format, page] = await Promise.all([
    getTranslations('registry.audit'),
    getTranslations('errors'),
    getFormatter(),
    getAuditLogs({
      before: before && UUID.test(before) ? before : undefined,
      result,
      actor: actor || undefined,
    }),
  ]);
  const href = (extra: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ result, actor: actor || undefined, ...extra })) {
      if (value) query.set(key, value);
    }
    const text = query.toString();
    return text ? `${BASE}?${text}` : BASE;
  };
  const json = (value: unknown) => JSON.stringify(value, null, 2);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          <FileClock className="size-6 text-brand" aria-hidden="true" />
          {t('title')}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{t('intro')}</p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label={t('filter')}>
        {[undefined, ...AUDIT_RESULTS].map((value) => (
          <Link
            key={value ?? 'all'}
            href={href({ result: value, before: undefined })}
            aria-current={value === result ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors sm:text-[13px]',
              value === result
                ? 'border-primary bg-primary-soft text-brand'
                : 'border-line text-fg-muted hover:bg-surface-2',
            )}
          >
            {value ? t(`results.${value}`) : t('all')}
          </Link>
        ))}
      </nav>
      <form method="get" role="search" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        {result && <input type="hidden" name="result" value={result} />}
        <RegistrySearchField
          label={t('actor')}
          placeholder={t('actorHint')}
          defaultValue={actor}
          name="actor"
        />
        <Button type="submit" variant="secondary" size="lg" icon={FileClock}>
          {t('search')}
        </Button>
        {(actor || result) && (
          <ButtonLink href={BASE} variant="ghost" size="lg" icon={RotateCcw}>
            {t('reset')}
          </ButtonLink>
        )}
      </form>

      {page === null ? (
        <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>
      ) : page.items.length === 0 ? (
        <EmptyState icon={FileClock} title={t('empty')} className="bg-surface py-14" />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
          {page.items.map((entry) => (
            <li key={entry.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-col gap-1.5 px-4 py-3 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="w-40 shrink-0 text-sm whitespace-nowrap text-fg-muted tabular-nums sm:text-[13px]">
                    {format.dateTime(new Date(entry.createdAt), {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs break-all text-fg">
                      {entry.method} {entry.route}
                    </span>
                    <span className="block text-xs break-all text-fg-subtle">
                      {entry.actor ? `${entry.actor.name} · ${entry.actor.email}` : t('anonymous')}
                    </span>
                  </span>
                  <Badge tone={TONE[entry.result]}>
                    {t(`results.${entry.result}`)} · {entry.statusCode}
                  </Badge>
                </summary>
                <dl className="grid gap-3 border-t border-line bg-canvas px-4 py-3 text-xs sm:grid-cols-2">
                  {[
                    [t('roles'), entry.actorRoles.join(', ') || t('none')],
                    [t('target'), entry.targetId ?? t('none')],
                    [t('ip'), entry.ip ?? t('none')],
                    [t('request'), entry.requestId],
                    [t('userAgent'), entry.userAgent ?? t('none')],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-fg-subtle">{label}</dt>
                      <dd className="font-mono break-all text-fg">{value}</dd>
                    </div>
                  ))}
                  {entry.input !== null && entry.input !== undefined && (
                    <div className="sm:col-span-2">
                      <dt className="text-fg-subtle">{t('input')}</dt>
                      <dd>
                        <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-surface-2 p-2 text-fg">
                          {json(entry.input)}
                        </pre>
                      </dd>
                    </div>
                  )}
                  {entry.changes.map((change, index) => (
                    <div key={index} className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
                      <div>
                        <dt className="text-fg-subtle">{t('before', { type: change.type })}</dt>
                        <dd>
                          <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-surface-2 p-2 text-fg">
                            {json(change.before)}
                          </pre>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-fg-subtle">{t('after', { type: change.type })}</dt>
                        <dd>
                          <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-surface-2 p-2 text-fg">
                            {json(change.after)}
                          </pre>
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </details>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {before && (
          <ButtonLink href={href({ before: undefined })} variant="secondary" icon={RotateCcw}>
            {t('newest')}
          </ButtonLink>
        )}
        {page?.next && (
          <ButtonLink
            href={href({ before: page.next })}
            variant="secondary"
            trailingIcon={ChevronRight}
          >
            {t('older')}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
