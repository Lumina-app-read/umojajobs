import { countryName, flagEmoji, type PublicJobOfferSummary } from '@opportinities/shared';
import { BadgeCheck, Building, CalendarClock, MapPin } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { formatSalary } from './format';
import type { JobsBase } from './routes';
import { TimingIndicator } from './timing-indicator';

/** Carte d'offre : intitulé, entreprise, lieu, contrat, salaire éventuel et date limite. */
export function JobCard({
  offer,
  base = '/jobs',
}: {
  offer: PublicJobOfferSummary;
  base?: JobsBase;
}) {
  const t = useTranslations('jobs');
  const format = useFormatter();
  const locale = useLocale();
  const salary = formatSalary(offer, format, t);
  const deadline = format.dateTime(new Date(`${offer.endDate}T12:00:00Z`), {
    dateStyle: 'medium',
  });

  return (
    <article className="lift group relative flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base leading-snug font-semibold text-fg">
            {/* Le lien couvre toute la carte (zone de clic plus confortable). */}
            <Link
              href={`${base}/${offer.slug}`}
              className="after:absolute after:inset-0 after:rounded-xl group-hover:text-brand"
            >
              {offer.title}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-fg-muted">
            <Building className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{offer.companyName}</span>
          </p>
        </div>
        <TimingIndicator
          status={offer.status}
          endsAt={offer.endsAt}
          endDate={offer.endDate}
          className="shrink-0 pt-0.5"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
        {offer.status === 'active' && (
          <Badge tone="success" icon={BadgeCheck}>
            {t('public.verified')}
          </Badge>
        )}
        <span className="flex items-center gap-1.5">
          <MapPin className="size-4" aria-hidden="true" />
          <span aria-hidden="true">{flagEmoji(offer.countryIso2)}</span>
          {[offer.city?.name, countryName(offer.countryIso2, locale)].filter(Boolean).join(', ')}
        </span>
        <Badge tone="neutral">{t(`enums.contractType.${offer.contractType}`)}</Badge>
        <Badge tone="neutral">{t(`enums.workMode.${offer.workMode}`)}</Badge>
        <Badge tone="primary">
          {locale === 'fr' ? offer.category.nameFr : offer.category.nameEn}
        </Badge>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[13px]">
        <span className="flex items-center gap-1.5 text-fg-muted">
          <CalendarClock className="size-4" aria-hidden="true" />
          {t('public.deadline', { date: deadline })}
        </span>
        {salary && <span className="font-semibold text-fg">{salary}</span>}
      </div>
    </article>
  );
}
