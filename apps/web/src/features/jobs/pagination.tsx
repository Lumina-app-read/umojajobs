import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/button-link';

/** Pagination précédent / suivant d'une liste d'offres. `href` construit l'adresse d'une page. */
export async function JobPagination({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const t = await getTranslations('jobs.public');
  return (
    <nav
      className="flex items-center justify-between gap-3"
      aria-label={t('page', { page, pages })}
    >
      {page > 1 ? (
        <ButtonLink href={href(page - 1)} variant="secondary" icon={ChevronLeft}>
          {t('previous')}
        </ButtonLink>
      ) : (
        <span />
      )}
      <span className="text-sm text-fg-muted">{t('page', { page, pages })}</span>
      {page < pages ? (
        <ButtonLink href={href(page + 1)} variant="secondary" trailingIcon={ChevronRight}>
          {t('next')}
        </ButtonLink>
      ) : (
        <span />
      )}
    </nav>
  );
}
