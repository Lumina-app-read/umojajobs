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
  Lightbulb,
  Link2,
  ListChecks,
  Lock,
  type LucideIcon,
  MapPin,
  MapPinned,
  Newspaper,
  Paperclip,
  Phone,
  ScrollText,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  Megaphone,
  Unlock,
  Wallet,
} from 'lucide-react';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { formatSalary } from './format';
import { SaveJobButton } from './save-button';
import type { JobsBase } from './routes';
import { TimingIndicator } from './timing-indicator';
import { CandidateRulesGate, CandidateRulesList } from './candidate-rules';
import { UnlockButton } from './unlock-button';
import { UnlockedContents } from './unlocked-contents';
import {
  getCreditBalance,
  getCreditCosts,
  getCurrentUser,
  getMyJobOffers,
  getSavedJobs,
  getUnlockedContents,
  getUnlocks,
} from '@/lib/api/server';

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
  const [saved, costs, credits, unlocks, mine, me] = await Promise.all([
    signedIn ? getSavedJobs() : null,
    getCreditCosts(),
    signedIn ? getCreditBalance() : null,
    signedIn ? getUnlocks() : null,
    signedIn ? getMyJobOffers() : null,
    signedIn ? getCurrentUser().catch(() => null) : null,
  ]);
  const isUnlocked = (unlocks ?? []).some((entry) => entry.offer.id === offer.id);
  // Le règlement des candidats est présenté après le paiement, jamais avant.
  const rulesAccepted = Boolean(me?.data?.candidateTermsAccepted);
  const unlocked = isUnlocked && rulesAccepted ? await getUnlockedContents(offer.id) : null;
  const isSaved = (saved ?? []).some((entry) => entry.offer.id === offer.id);
  const cost = costs.find((entry) => entry.service === 'unlock_standard')?.credits ?? null;
  // Le contributeur retrouve les coordonnées de sa propre offre dans ses publications.
  const own = (mine ?? []).some((entry) => entry.id === offer.id);

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

  const facts: { icon: LucideIcon; value: string }[] = [
    {
      icon: MapPin,
      value: `${flagEmoji(offer.countryIso2)} ${[offer.city?.name, countryName(offer.countryIso2, locale)].filter(Boolean).join(', ')}`,
    },
    { icon: ScrollText, value: t(`enums.contractType.${offer.contractType}`) },
    { icon: Laptop, value: t(`enums.workMode.${offer.workMode}`) },
    ...(salary ? [{ icon: Wallet, value: salary }] : []),
    { icon: CalendarClock, value: t('public.deadline', { date: day(offer.endDate) }) },
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
      icon: Phone,
      label: t('public.detail.unlockPhone'),
      present: offer.unlockContents.applicationPhone,
    },
    {
      icon: Lightbulb,
      label: t('public.detail.unlockTips'),
      present: offer.unlockContents.contributorTips,
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

      <header className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xs">
        <div
          className="h-1.5 bg-gradient-to-r from-primary via-brand to-accent"
          aria-hidden="true"
        />
        <div className="grid gap-5 p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div
              className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary-soft text-lg font-bold text-brand sm:size-16 sm:text-xl"
              aria-hidden="true"
            >
              {initials(offer.companyName)}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl leading-8 font-bold tracking-[-0.02em] text-fg sm:text-[30px] sm:leading-10">
                {offer.title}
              </h1>
              <p className="mt-1 flex items-center gap-2 text-base text-fg-muted">
                <Building className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{offer.companyName}</span>
              </p>
            </div>
          </div>

          <ul className="flex flex-wrap gap-2">
            {facts.map(({ icon: Icon, value }) => (
              <li
                key={value}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-fg"
              >
                <Icon className="size-4 text-fg-subtle" aria-hidden="true" />
                {value}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
            <TimingIndicator
              status={offer.status}
              endsAt={offer.endsAt}
              endDate={offer.endDate}
              pulse
            />
            {offer.status === 'active' && (
              <Badge tone="success" icon={BadgeCheck}>
                {t('public.verified')}
              </Badge>
            )}
            <Badge tone="primary">
              {locale === 'fr' ? offer.category.nameFr : offer.category.nameEn}
            </Badge>
            <span className="flex items-center gap-1.5 text-[13px] text-fg-subtle sm:ml-auto">
              <Clock className="size-4" aria-hidden="true" />
              {t('public.published', {
                date: format.dateTime(new Date(offer.publishedAt), { dateStyle: 'medium' }),
              })}
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="grid gap-6" lang={offer.contentLanguage ?? undefined}>
          <ContentCard icon={FileText} title={t('public.detail.about')}>
            <p className="text-[15px] leading-7 whitespace-pre-line text-fg-muted">
              {offer.description}
            </p>
          </ContentCard>
          {offer.requirements && (
            <ContentCard icon={UserRoundCheck} title={t('public.detail.profile')}>
              <p className="text-[15px] leading-7 whitespace-pre-line text-fg-muted">
                {offer.requirements}
              </p>
            </ContentCard>
          )}
          {offer.skills.length > 0 && (
            <ContentCard icon={Sparkles} title={t('public.detail.skills')}>
              <ul className="flex flex-wrap gap-2">
                {offer.skills.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-full bg-primary-soft px-3 py-1 text-[13px] font-medium text-brand"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            </ContentCard>
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
              {isUnlocked ? (
                <Unlock className="size-4 text-success" aria-hidden="true" />
              ) : (
                <Lock className="size-4 text-brand" aria-hidden="true" />
              )}
              {isUnlocked ? t('unlock.title') : t('public.detail.unlockTitle')}
            </h2>
            {isUnlocked && !rulesAccepted ? (
              <div className="mt-4">
                <CandidateRulesGate />
              </div>
            ) : unlocked ? (
              <div className="mt-4 grid gap-4">
                <UnlockedContents contents={unlocked} />
                <details className="group rounded-lg border border-line bg-surface p-3.5">
                  <summary className="cursor-pointer text-[13px] font-semibold text-fg">
                    {t('candidateRules.reminder')}
                  </summary>
                  <div className="mt-3">
                    <CandidateRulesList compact />
                  </div>
                </details>
              </div>
            ) : isUnlocked ? (
              <p className="mt-3 text-[13px] text-fg-muted">{t('public.unavailable')}</p>
            ) : (
              <>
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
                {offer.status === 'active' && (
                  <div className="mt-5 grid gap-2">
                    {own ? (
                      <ButtonLink
                        href="/dashboard/publications"
                        variant="secondary"
                        icon={Megaphone}
                        fullWidth
                      >
                        {t('unlock.own')}
                      </ButtonLink>
                    ) : (
                      <UnlockButton
                        offerId={offer.id}
                        cost={cost}
                        balance={credits?.balance ?? 0}
                        signedIn={signedIn}
                      />
                    )}
                  </div>
                )}
              </>
            )}
            {offer.status === 'active' && (
              <div className="mt-2 grid">
                <SaveJobButton offerId={offer.id} initialSaved={isSaved} signedIn={signedIn} />
              </div>
            )}
          </section>
        </aside>
      </div>
    </article>
  );
}

/** Initiales de l'entreprise (deux lettres au plus), en guise de logo. */
function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Bloc de contenu de la fiche : titre avec icône, corps. */
function ContentCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-fg">
        <Icon className="size-4 text-brand" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}
