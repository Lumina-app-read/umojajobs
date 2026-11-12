import { AFRICAN_COUNTRIES, AFRICAN_COUNTRY_COUNT, flagEmoji } from '@opportinities/shared';
import {
  BellRing,
  CalendarCheck,
  ChevronDown,
  CircleCheck,
  FileCheck2,
  FileText,
  Globe2,
  Info,
  Languages,
  LogIn,
  type LucideIcon,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  HeartHandshake,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Logo } from '@/components/layout/logo';
import { ButtonLink } from '@/components/ui/button-link';
import { cn } from '@/lib/cn';
import workingProfessional from '../../../public/images/landing/man class.jpg';
import { SectionHeading } from './section-heading';

const container = 'mx-auto max-w-6xl px-4 sm:px-6';

function IconChip({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-brand',
        className,
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}

/** Bandeau de confiance : uniquement des faits vérifiables, aucun chiffre de communauté inventé. */
export async function TrustBand() {
  const t = await getTranslations('landing.trust');
  const items: { icon: LucideIcon; label: string }[] = [
    { icon: Globe2, label: t('countries') },
    { icon: ShieldCheck, label: t('moderation') },
    { icon: UserRound, label: t('account') },
    { icon: Languages, label: t('languages') },
  ];
  return (
    <section aria-label={t('label')} className="border-y border-line bg-surface">
      <ul
        className={cn(
          container,
          'stagger grid grid-cols-1 gap-5 py-8 sm:grid-cols-2 lg:grid-cols-4',
        )}
      >
        {items.map(({ icon, label }) => (
          <li key={label} className="flex items-center gap-3 text-sm font-semibold text-fg">
            <IconChip icon={icon} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Trois étapes numérotées : c'est un vrai parcours. */
export async function HowItWorks() {
  const t = await getTranslations('landing.how');
  const steps: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: UserPlus, title: t('step1Title'), body: t('step1Body') },
    { icon: Search, title: t('step2Title'), body: t('step2Body') },
    { icon: FileCheck2, title: t('step3Title'), body: t('step3Body') },
  ];
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="py-20 sm:py-28">
      <div className={container}>
        <SectionHeading
          id="how-title"
          eyebrow={t('eyebrow')}
          title={t('title')}
          subtitle={t('subtitle')}
        />
        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map(({ icon, title, body }, index) => (
            <li
              key={title}
              className="reveal lift relative rounded-xl border border-line bg-surface p-6 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <IconChip icon={icon} />
                <span className="text-[13px] font-bold text-fg-subtle tabular-nums" aria-hidden>
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-base font-bold text-fg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Pays mis en avant, du nord au sud et d'ouest en est (liste non classée). */
const FEATURED_COUNTRIES = [
  'SN',
  'CI',
  'CM',
  'CD',
  'NG',
  'GH',
  'KE',
  'RW',
  'MA',
  'TN',
  'EG',
  'ZA',
] as const;

/** Opportunités : comment les offres sont contrôlées, et la couverture géographique. */
export async function JobsSection() {
  const t = await getTranslations('landing.jobs');
  const locale = await getLocale();
  const countries = FEATURED_COUNTRIES.map((iso2) =>
    AFRICAN_COUNTRIES.find((country) => country.iso2 === iso2),
  ).filter((country) => country !== undefined);
  const points: { icon: LucideIcon; label: string }[] = [
    { icon: CircleCheck, label: t('point1') },
    { icon: CalendarCheck, label: t('point2') },
    { icon: ShieldCheck, label: t('point3') },
  ];

  return (
    <section
      id="jobs"
      aria-labelledby="jobs-title"
      className="border-y border-line bg-surface py-20 sm:py-28"
    >
      <div className={cn(container, 'grid items-center gap-12 lg:grid-cols-2 lg:gap-16')}>
        <div>
          <SectionHeading
            id="jobs-title"
            align="left"
            eyebrow={t('eyebrow')}
            title={t('title')}
            subtitle={t('subtitle')}
          />
          <ul className="mt-8 grid gap-3.5">
            {points.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-3 text-[15px] text-fg">
                <Icon className="mt-0.5 size-5 text-success" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
          <ButtonLink href="/register" size="lg" icon={BellRing} className="mt-9">
            {t('cta')}
          </ButtonLink>
        </div>

        <div className="reveal rounded-2xl border border-line bg-canvas p-6 sm:p-8">
          <h3 className="text-sm font-semibold text-fg">{t('countriesTitle')}</h3>
          <ul className="mt-5 grid grid-cols-2 gap-2.5">
            {countries.map((country) => (
              <li
                key={country.iso2}
                className="flex min-h-11 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] leading-tight font-medium text-fg"
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {flagEmoji(country.iso2)}
                </span>
                <span>{locale === 'fr' ? country.nameFr : country.nameEn}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-center gap-2 text-[13px] text-fg-muted">
            <Globe2 className="size-4 text-brand" aria-hidden="true" />
            {t('allCountries', { count: AFRICAN_COUNTRY_COUNT - countries.length })}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Career Studio : la promesse (aucune invention), les documents, le principe de paiement. */
export async function StudioSection() {
  const t = await getTranslations('landing.studio');
  const tPreview = await getTranslations('landing.preview');
  const documents = (['doc1', 'doc2', 'doc3', 'doc4', 'doc5', 'doc6', 'doc7', 'doc8'] as const).map(
    (key) => t(key),
  );
  return (
    <section id="career-studio" aria-labelledby="studio-title" className="py-20 sm:py-28">
      <div className={cn(container, 'grid items-center gap-14 lg:grid-cols-2 lg:gap-16')}>
        <div className="reveal order-last mx-auto w-full max-w-[500px] rounded-2xl border border-line bg-surface p-3 shadow-lg lg:order-first">
          <div className="overflow-hidden rounded-xl">
            <Image
              src={workingProfessional}
              alt={t('imageAlt')}
              placeholder="blur"
              sizes="(min-width: 1024px) 480px, 100vw"
              className="aspect-[4/3] w-full object-cover object-top"
            />
          </div>
          {/* Aperçu de CV, sous la photo (composition décorative). */}
          <div
            aria-hidden="true"
            className="mt-3 flex items-center gap-4 rounded-xl border border-line bg-surface-raised p-4"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
              <FileText className="size-5" />
            </span>
            <span className="grid min-w-0 flex-1 gap-1.5">
              <span className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
                {tPreview('cvLabel')}
              </span>
              <span className="h-2 w-3/4 rounded-full bg-fg/15" />
              <span className="h-1.5 w-1/2 rounded-full bg-fg/10" />
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-success">
              <CircleCheck className="size-4" />
              <span className="max-sm:sr-only">{tPreview('cvReady')}</span>
            </span>
          </div>
        </div>

        <div>
          <SectionHeading
            id="studio-title"
            align="left"
            eyebrow={t('eyebrow')}
            title={t('title')}
            subtitle={t('subtitle')}
          />
          <h3 className="mt-8 text-sm font-semibold text-fg">{t('documentsTitle')}</h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {documents.map((label) => (
              <li key={label} className="flex items-center gap-2.5 text-sm text-fg-muted">
                <FileText className="size-4 text-brand" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-start gap-2.5 rounded-lg bg-primary-soft px-4 py-3 text-sm text-fg">
            <Sparkles className="mt-0.5 size-4 text-brand" aria-hidden="true" />
            {t('flow')}
          </p>
          <ButtonLink href="/register" size="lg" icon={FileText} className="mt-8">
            {t('cta')}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/** Contribuer : parcours honnête, sans taux ni seuil codés en dur (ce sont des paramètres). */
export async function ShareSection() {
  const t = await getTranslations('landing.share');
  const steps: { icon: LucideIcon; title: string; body: string }[] = [
    { icon: Share2, title: t('step1Title'), body: t('step1Body') },
    { icon: ShieldCheck, title: t('step2Title'), body: t('step2Body') },
    { icon: HeartHandshake, title: t('step3Title'), body: t('step3Body') },
  ];
  return (
    <section
      id="share"
      aria-labelledby="share-title"
      className="border-y border-line bg-surface py-20 sm:py-28"
    >
      <div className={container}>
        <SectionHeading
          id="share-title"
          eyebrow={t('eyebrow')}
          title={t('title')}
          subtitle={t('subtitle')}
        />
        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map(({ icon, title, body }) => (
            <li key={title} className="reveal lift rounded-xl border border-line bg-canvas p-6">
              <IconChip icon={icon} />
              <h3 className="mt-5 text-base font-bold text-fg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-col items-center gap-6 text-center">
          <p className="flex max-w-xl items-start gap-2 text-[13px] text-fg-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t('note')}
          </p>
          <ButtonLink href="/register" size="lg" icon={Share2}>
            {t('cta')}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/** FAQ : accordéon natif (<details>), accessible au clavier sans JavaScript. */
export async function Faq() {
  const t = await getTranslations('landing.faq');
  const items = ([1, 2, 3, 4, 5, 6, 7] as const).map((n) => ({
    question: t(`q${n}`),
    answer: t(`a${n}`),
  }));
  return (
    <section aria-labelledby="faq-title" className="py-20 sm:py-28">
      <div className={cn(container, 'max-w-3xl')}>
        <SectionHeading id="faq-title" eyebrow={t('eyebrow')} title={t('title')} />
        <div className="mt-12 divide-y divide-line rounded-xl border border-line bg-surface">
          {items.map(({ question, answer }) => (
            <details key={question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold text-fg transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown
                  className="size-5 shrink-0 text-fg-subtle transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-fg-muted">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Appel à l'action final : bandeau bleu nuit, une action principale. */
export async function FinalCta() {
  const t = await getTranslations('landing.final');
  return (
    <section className="pb-20 sm:pb-28">
      <div className={container}>
        <div className="reveal relative overflow-hidden rounded-2xl bg-navy px-6 py-14 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/30 blur-3xl"
          />
          <Logo onDark size={40} className="relative" />
          <h2 className="relative mt-6 text-heading-lg font-bold tracking-[-0.02em] text-white sm:text-display-lg">
            {t('title')}
          </h2>
          <p className="relative mt-3 text-base text-on-navy-muted">{t('subtitle')}</p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href="/register" size="xl" icon={UserPlus}>
              {t('cta')}
            </ButtonLink>
            <ButtonLink
              href="/login"
              variant="secondary"
              size="xl"
              icon={LogIn}
              className="border-white/20 bg-white/10 text-white hover:bg-white/15"
            >
              {t('login')}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
