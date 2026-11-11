import { flagEmoji } from '@opportinities/shared';
import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  Check,
  FileText,
  Globe2,
  MapPin,
  Route,
  Search,
  Unlock,
  UserPlus,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import handshake from '../../../public/images/landing/womwn and man.jpg';

/**
 * Composition d'interface : barre de recherche, photo, offre et CV, empilés sans chevauchement
 * (rien ne masque la photo). Illustrative : l'offre est signalée comme exemple.
 */
async function HeroVisual() {
  const t = await getTranslations('landing');
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-2xl border border-line bg-surface p-3 shadow-lg lg:mx-0">
      <div
        aria-hidden="true"
        className="flex h-11 items-center gap-2.5 rounded-xl border border-line bg-canvas px-4 text-sm text-fg-subtle"
      >
        <Search className="size-4 text-brand" />
        {t('preview.searchPlaceholder')}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl bg-white">
        <Image
          src={handshake}
          alt={t('hero.imageAlt')}
          placeholder="blur"
          priority
          sizes="(min-width: 1024px) 500px, 100vw"
          className="aspect-[16/10] w-full object-cover"
        />
      </div>

      <div aria-hidden="true" className="mt-3 grid gap-3 sm:grid-cols-[1fr_9.5rem]">
        {/* Offre d'exemple */}
        <div className="rounded-xl border border-line bg-surface-raised p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
              {t('preview.label')}
            </span>
            <Badge tone="success" icon={BadgeCheck}>
              {t('preview.verified')}
            </Badge>
          </div>
          <p className="mt-2 text-[15px] font-bold text-fg">{t('preview.jobTitle')}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-fg-muted">
            <Briefcase className="size-3.5" />
            {t('preview.company')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-fg-muted">
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              <span>{flagEmoji('SN')}</span>
              {t('preview.city')}
            </span>
            <Badge tone="neutral">{t('preview.contract')}</Badge>
            <span className="flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {t('preview.deadline')}
            </span>
          </div>
          <span className="mt-3.5 flex h-9 items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-fg">
            <Unlock className="size-4" />
            {t('preview.unlock')}
          </span>
        </div>

        {/* CV prêt */}
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised p-4 sm:flex-col sm:items-start sm:justify-between">
          <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-brand">
            <FileText className="size-5" />
          </span>
          <span>
            <span className="block text-xs text-fg-subtle">{t('preview.cvLabel')}</span>
            <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-fg">
              <Check className="size-3.5 shrink-0 text-success" />
              {t('preview.cvReady')}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Hero : promesse, appel à l'action principal, réassurance factuelle et composition visuelle. */
export async function Hero() {
  const t = await getTranslations('landing.hero');
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_60%_at_80%_0%,var(--primary-soft),transparent_70%)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 pt-12 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pt-16 lg:pb-24">
        <div className="stagger">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-fg-muted shadow-xs">
            <Globe2 className="size-4 text-brand" aria-hidden="true" />
            {t('eyebrow')}
          </p>
          <h1 className="mt-6 text-[2.25rem] leading-[2.65rem] font-extrabold tracking-[-0.03em] text-fg sm:text-display-xl sm:leading-[4rem]">
            {t('title')}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
            {t('subtitle')}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/register" size="xl" icon={UserPlus}>
              {t('ctaPrimary')}
            </ButtonLink>
            <ButtonLink
              href={{ pathname: '/', hash: 'how-it-works' }}
              variant="secondary"
              size="xl"
              icon={Route}
            >
              {t('ctaSecondary')}
            </ButtonLink>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-muted">
            {[t('free'), t('languages')].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="size-4 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}
