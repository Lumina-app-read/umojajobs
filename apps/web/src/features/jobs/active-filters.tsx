import { Info, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export interface ActiveFilter {
  key: string;
  label: string;
  flag?: string;
  /** Adresse de la même recherche sans ce filtre. */
  href: string;
}

/**
 * Filtres appliqués, sous forme de pastilles retirables une à une (simples liens : la recherche
 * reste rendue par le serveur et partageable).
 */
export async function ActiveFilters({
  filters,
  clearHref,
  note,
}: {
  filters: ActiveFilter[];
  clearHref: string;
  /** Précision affichée sous les pastilles (pays du profil appliqué par défaut). */
  note?: string;
}) {
  const t = await getTranslations('jobs.public');
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold text-fg-subtle uppercase tracking-wide">
          {t('activeFilters')}
        </span>
        <ul className="contents">
          {filters.map((filter) => (
            <li key={filter.key}>
              <Link
                href={filter.href}
                scroll={false}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft pl-2.5 pr-2 text-[13px] font-medium text-brand transition-colors hover:border-primary"
                aria-label={t('removeFilter', { label: filter.label })}
              >
                {filter.flag && <span aria-hidden="true">{filter.flag}</span>}
                <span className="max-w-48 truncate">{filter.label}</span>
                <X className="size-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href={clearHref}
          scroll={false}
          className="ml-1 text-[13px] font-medium text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          {t('clearAll')}
        </Link>
      </div>
      {note && (
        <p className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          {note}
        </p>
      )}
    </div>
  );
}
