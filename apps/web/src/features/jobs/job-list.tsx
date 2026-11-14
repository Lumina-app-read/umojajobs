import { countryName, flagEmoji, type PublicJobOfferSummary } from '@opportinities/shared';
import { Building, CalendarClock, MapPin } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { JobsBase } from './routes';
import { TimingIndicator } from './timing-indicator';

/**
 * Liste compacte des offres : une ligne par offre, lisible même sur des milliers de résultats
 * (avec la pagination). Toute la ligne est cliquable.
 */
export function JobList({ offers, base }: { offers: PublicJobOfferSummary[]; base: JobsBase }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      {offers.map((offer) => (
        <JobRow key={offer.id} offer={offer} base={base} />
      ))}
    </ul>
  );
}

function JobRow({ offer, base }: { offer: PublicJobOfferSummary; base: JobsBase }) {
  const t = useTranslations('jobs');
  const format = useFormatter();
  const locale = useLocale();
  const place = [offer.city?.name, countryName(offer.countryIso2, locale)]
    .filter(Boolean)
    .join(', ');
  const deadline = format.dateTime(new Date(`${offer.endDate}T12:00:00Z`), {
    dateStyle: 'medium',
  });

  return (
    <li className="group relative flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold text-fg group-hover:text-brand">
          <Link href={`${base}/${offer.slug}`} className="after:absolute after:inset-0">
            {offer.title}
          </Link>
        </h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm sm:text-[13px] text-fg-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <Building className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{offer.companyName}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span aria-hidden="true">{flagEmoji(offer.countryIso2)}</span>
            {place}
          </span>
          <span>{t(`enums.contractType.${offer.contractType}`)}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4 text-sm sm:text-[13px] sm:flex-col sm:items-end sm:gap-1">
        <TimingIndicator status={offer.status} endsAt={offer.endsAt} endDate={offer.endDate} />
        <span className="flex items-center gap-1.5 text-fg-subtle">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          {deadline}
        </span>
      </div>
    </li>
  );
}
