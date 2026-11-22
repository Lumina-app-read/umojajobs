import { type RegistryPerson } from '@opportinities/shared';
import { type LucideIcon, RotateCcw, Search } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { JobPagination } from '@/features/jobs/pagination';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { registryHref } from './query';
import { RegistrySearchField } from './registry-search';

/** Cadre commun des registres : titre, totaux, filtres, recherche, tableau et pagination. */
export async function RegistryLayout({
  base,
  icon: Icon,
  title,
  intro,
  searchHint,
  state,
  statuses,
  stats,
  data,
  children,
}: {
  base: string;
  icon: LucideIcon;
  title: string;
  intro: string;
  searchHint: string;
  state: { q: string; status: string | null; page: number };
  statuses?: { value: string; label: string }[];
  stats: ReactNode;
  data: { total: number; pageSize: number } | null;
  children: ReactNode;
}) {
  const t = await getTranslations('registry');
  const tErrors = await getTranslations('errors');
  const filtered = state.q !== '' || state.status !== null;
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          <Icon className="size-6 text-brand" aria-hidden="true" />
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{intro}</p>
      </div>

      {data === null ? (
        <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>
      ) : (
        <>
          {stats}
          <div className="grid gap-4">
            {statuses && (
              <nav className="flex flex-wrap gap-2" aria-label={t('filter')}>
                {[{ value: null, label: t('all') }, ...statuses].map((option) => (
                  <Link
                    key={option.value ?? 'all'}
                    href={registryHref(base, { q: state.q, status: option.value })}
                    aria-current={option.value === state.status ? 'page' : undefined}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors sm:text-[13px]',
                      option.value === state.status
                        ? 'border-primary bg-primary-soft text-brand'
                        : 'border-line text-fg-muted hover:bg-surface-2',
                    )}
                  >
                    {option.label}
                  </Link>
                ))}
              </nav>
            )}
            <form
              method="get"
              role="search"
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              {state.status && <input type="hidden" name="status" value={state.status} />}
              <RegistrySearchField
                label={t('search')}
                placeholder={searchHint}
                defaultValue={state.q}
              />
              <Button type="submit" variant="secondary" size="lg" icon={Search}>
                {t('submit')}
              </Button>
              {filtered && (
                <ButtonLink href={base} variant="ghost" size="lg" icon={RotateCcw}>
                  {t('reset')}
                </ButtonLink>
              )}
            </form>
          </div>

          {data.total === 0 ? (
            <EmptyState
              icon={Icon}
              title={filtered ? t('noMatch') : t('empty')}
              description={filtered ? t('noMatchBody') : undefined}
              className="bg-surface py-14"
            />
          ) : (
            <div className="grid gap-3">
              <p className="text-sm text-fg-muted sm:text-[13px]">
                {t('results', { count: data.total })}
              </p>
              {children}
            </div>
          )}
          <JobPagination
            page={state.page}
            pages={Math.ceil(data.total / data.pageSize)}
            href={(page) => registryHref(base, { ...state, page })}
          />
        </>
      )}
    </div>
  );
}

/** Nom et adresse d'une personne dans un tableau. */
export function PersonCell({ person }: { person: RegistryPerson }) {
  return (
    <>
      <span className="block font-medium">{person.name}</span>
      <span className="block text-xs break-all text-fg-subtle">{person.email}</span>
    </>
  );
}

export function OfferCell({ offer }: { offer: { title: string; companyName: string | null } }) {
  return (
    <>
      <span className="block font-medium">{offer.title}</span>
      {offer.companyName && (
        <span className="block text-xs text-fg-subtle">{offer.companyName}</span>
      )}
    </>
  );
}
