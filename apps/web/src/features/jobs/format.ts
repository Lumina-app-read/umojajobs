import { type PublicJobOfferSummary } from '@opportinities/shared';
import { type useFormatter, type useTranslations } from 'next-intl';

type JobsTranslator = ReturnType<typeof useTranslations<'jobs'>>;
type Formatter = ReturnType<typeof useFormatter>;

/** Salaire lisible (« 350 000 à 500 000 XOF »), ou null si l'annonce ne l'indique pas. */
export function formatSalary(
  offer: Pick<PublicJobOfferSummary, 'salaryMin' | 'salaryMax' | 'salaryCurrency'>,
  format: Formatter,
  t: JobsTranslator,
): string | null {
  const money = (value: string) => format.number(Number(value), { maximumFractionDigits: 0 });
  const currency = offer.salaryCurrency ?? '';
  if (offer.salaryMin && offer.salaryMax) {
    return t('moderation.salaryRange', {
      min: money(offer.salaryMin),
      max: money(offer.salaryMax),
      currency,
    });
  }
  if (offer.salaryMin) return t('moderation.salaryFrom', { min: money(offer.salaryMin), currency });
  if (offer.salaryMax) return t('moderation.salaryUpTo', { max: money(offer.salaryMax), currency });
  return null;
}
