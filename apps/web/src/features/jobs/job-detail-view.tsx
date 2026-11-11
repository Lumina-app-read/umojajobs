import { countryName, flagEmoji, type PublicJobOfferDetail } from '@opportinities/shared';
import {
  ArrowLeft,
  AtSign,
  BadgeCheck,
  Building,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  FileText,
  GraduationCap,
  Laptop,
  Link2,
  ListChecks,
  Lock,
  type LucideIcon,
  MapPin,
  MapPinned,
  Newspaper,
  Paperclip,
  ScrollText,
  TrendingUp,
  Unlock,
  Wallet,
} from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { formatSalary } from './format';
import { SaveJobButton } from './save-button';
import type { JobsBase } from './routes';
import { getSavedJobs } from '@/lib/api/server';

/**
 * Fiche d'une offre : contenu gratuit, contenu du déverrouillage annoncé sans révélation.
 * Sur le site public, le visiteur n'est pas connecté (un utilisateur connecté est redirigé vers
 * son espace personnel) ; dans l'espace personnel, il l'est toujours.
 */
export async function JobDetailView({
  offer,
  base,
}: {
  offer: PublicJobOfferDetail;
  base: JobsBase;
}) {
  const t = await getTranslations('jobs');
  const format = await getFormatter();
  const locale = await getLocale();
  const signedIn = base === '/dashboard/jobs';
  const saved = signedIn ? ((await getSavedJobs()) ?? []) : [];
  const isSaved = saved.some((entry) => entry.offer.id === offer.id);

  const day = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { dateStyle: 'long' });
  const notSpecified = t('public.detail.notSpecified');
  const salary = formatSalary(offer, format, t);

  const summary: { icon: LucideIcon; label: string; value: string }[] = [
    {
      icon: MapPin,
      label: t('public.detail.location'),
      value: `${flagEmoji(offer.countryIso2)} ${[offer.city?.name, countryName(offer.countryIso2, locale)].filter(Boolean).join(', ')}`,
    },
    {
      icon: ScrollText,
      label: t('public.detail.contract'),
      value: t(`enums.contractType.${offer.contractType}`),
    },
    {
      icon: Laptop,
      label: t('public.detail.workMode'),
      value: t(`enums.workMode.${offer.workMode}`),
    },
    {
      icon: TrendingUp,
      label: t('public.detail.experience'),
      value: offer.experienceLevel
        ? t(`enums.experienceLevel.${offer.experienceLevel}`)
        : notSpecified,
    },
    {
      icon: GraduationCap,
      label: t('public.detail.education'),
      value: offer.educationLevel
        ? t(`enums.educationLevel.${offer.educationLevel}`)
        : notSpecified,
    },
    { icon: Wallet, label: t('public.detail.salary'), value: salary ?? notSpecified },
    { icon: CalendarDays, label: t('public.detail.start'), value: day(offer.startDate) },
    { icon: CalendarClock, label: t('public.detail.deadline'), value: day(offer.endDate) },
    {
      icon: Newspaper,
      label: t('public.detail.source'),
      value: t(`enums.sourceType.${offer.sourceType}`),
    },
  ];

  const unlock: { icon: LucideIcon; label: string; present: boolean }[] = [
    {
      icon: AtSign,
      label: t('public.detail.unlockEmail'),
      present: offer.unlockContents.applicationEmail,
    },
    {
      icon: Link2,
      label: t('public.detail.unlockUrl'),
      present: offer.unlockContents.applicationUrl,
    },
    {
      icon: MapPinned,
      label: t('public.detail.unlockAddress'),
      present: offer.unlockContents.applicationAddress,
    },
    {
      icon: ListChecks,
      label: t('public.detail.unlockInstructions'),
      present: offer.unlockContents.applicationInstructions,
    },
    {
      icon: FileText,
      label: t('public.detail.unlockDocument'),
      present: offer.unlockContents.originalDocument,
    },
    {
      icon: Paperclip,
      label: t('public.detail.unlockAttachments', { count: offer.unlockContents.attachments }),
      present: offer.unlockContents.attachments > 0,
    },
  ];

  return (
    <article className="grid gap-8">
      <div>
        <ButtonLink href={base} variant="ghost" size="sm" icon={ArrowLeft}>
          {t('public.detail.back')}
        </ButtonLink>
      </div>

      {offer.status === 'expired' && (
        <Alert tone="warning" title={t('public.detail.expired')}>
          {t('public.detail.expiredBody')}
        </Alert>
      )}

      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {offer.status === 'active' && (
            <Badge tone="success" icon={BadgeCheck}>
              {t('public.verified')}
            </Badge>
          )}
          <Badge tone="primary">
            {locale === 'fr' ? offer.category.nameFr : offer.category.nameEn}
          </Badge>
          <span className="flex items-center gap-1.5 text-[13px] text-fg-subtle">
            <Clock className="size-4" aria-hidden="true" />
            {t('public.published', {
              date: format.dateTime(new Date(offer.publishedAt), { dateStyle: 'medium' }),
            })}
          </span>
        </div>
        <h1
          className={
            signedIn
              ? 'text-2xl leading-8 font-bold tracking-[-0.02em] text-fg sm:text-[28px] sm:leading-9'
              : 'text-[28px] leading-9 font-bold tracking-[-0.02em] text-fg sm:text-display-lg'
          }
        >
          {offer.title}
        </h1>
        <p className="flex items-center gap-2 text-lg text-fg-muted">
          <Building className="size-5" aria-hidden="true" />
          {offer.companyName}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="grid gap-8" lang={offer.contentLanguage ?? undefined}>
          <section>
            <h2 className="text-lg font-semibold text-fg">{t('public.detail.about')}</h2>
            <p className="mt-3 text-[15px] leading-7 whitespace-pre-line text-fg-muted">
              {offer.description}
            </p>
          </section>
          {offer.requirements && (
            <section>
              <h2 className="text-lg font-semibold text-fg">{t('public.detail.profile')}</h2>
              <p className="mt-3 text-[15px] leading-7 whitespace-pre-line text-fg-muted">
                {offer.requirements}
              </p>
            </section>
          )}
          {offer.skills.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-fg">{t('public.detail.skills')}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {offer.skills.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-full bg-primary-soft px-3 py-1 text-[13px] font-medium text-brand"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="grid gap-5 lg:sticky lg:top-24">
          <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <h2 className="text-base font-semibold text-fg">{t('public.detail.summary')}</h2>
            <dl className="mt-4 grid gap-3">
              {summary.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                  <dt className="sr-only">{label}</dt>
                  <dd className="grid text-sm">
                    <span className="text-xs text-fg-subtle" aria-hidden="true">
                      {label}
                    </span>
                    <span className="font-medium text-fg">{value}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-primary/25 bg-primary-soft/40 p-5 shadow-xs">
            <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
              <Lock className="size-4 text-brand" aria-hidden="true" />
              {t('public.detail.unlockTitle')}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
              {t('public.detail.unlockIntro')}
            </p>
            <ul className="mt-4 grid gap-2">
              {unlock
                .filter((item) => item.present)
                .map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-sm text-fg">
                    <Check className="size-4 text-success" aria-hidden="true" />
                    <Icon className="size-4 text-fg-subtle" aria-hidden="true" />
                    {label}
                  </li>
                ))}
            </ul>
            <div className="mt-5 grid gap-2">
              {offer.status === 'active' && (
                <>
                  <Button icon={Unlock} disabled fullWidth>
                    {t('public.detail.unlockButton')}
                  </Button>
                  <p className="text-center text-xs text-fg-subtle">
                    {t('public.detail.unlockSoon')}
                  </p>
                  <SaveJobButton offerId={offer.id} initialSaved={isSaved} signedIn={signedIn} />
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}
