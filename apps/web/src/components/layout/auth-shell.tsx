import { FileText, Lock, type LucideIcon, Share2, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Image, { type StaticImageData } from 'next/image';
import { type ReactNode } from 'react';
import foundOpportunity from '../../../public/images/landing/found opp.jpg';
import team from '../../../public/images/landing/job team.jpg';
import { Logo } from './logo';

const VISUALS = { register: team, login: foundOpportunity } satisfies Record<
  string,
  StaticImageData
>;

const BENEFITS: { key: 'benefitVerified' | 'benefitShare' | 'benefitStudio'; icon: LucideIcon }[] =
  [
    { key: 'benefitVerified', icon: ShieldCheck },
    { key: 'benefitShare', icon: Share2 },
    { key: 'benefitStudio', icon: FileText },
  ];

/** Panneau bleu nuit (ordinateur uniquement) : promesse, trois bénéfices, photo, sécurité. */
async function AuthPanel({ visual }: { visual: keyof typeof VISUALS }) {
  const t = await getTranslations();
  return (
    <aside
      aria-label={t('auth.panel.label')}
      className="relative hidden overflow-hidden rounded-2xl bg-navy p-9 text-on-navy lg:flex lg:flex-col"
    >
      {/* Halo discret pour donner de la profondeur au bleu nuit. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-24 size-80 rounded-full bg-primary/30 blur-3xl"
      />
      <Logo onDark size={36} className="relative" />
      <p className="relative mt-7 max-w-sm text-heading-lg font-bold tracking-[-0.02em] text-white">
        {t('common.meta.tagline')}
      </p>
      <ul className="relative mt-7 grid gap-3.5">
        {BENEFITS.map(({ key, icon: Icon }) => (
          <li key={key} className="flex gap-3 text-sm leading-relaxed text-on-navy-muted">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-white">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="pt-1.5">{t(`auth.panel.${key}`)}</span>
          </li>
        ))}
      </ul>
      <figure className="relative mt-8 overflow-hidden rounded-xl ring-1 ring-white/10">
        <Image
          src={VISUALS[visual]}
          alt=""
          placeholder="blur"
          sizes="(min-width: 1024px) 520px, 0px"
          className="aspect-[16/9] w-full object-cover object-top"
        />
        <figcaption className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-navy shadow-md">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          {t('auth.panel.photoBadge')}
        </figcaption>
      </figure>
      <p className="relative mt-auto flex items-center gap-2 pt-7 text-xs text-on-navy-muted">
        <Lock className="size-3.5" aria-hidden="true" />
        {t('auth.panel.security')}
      </p>
    </aside>
  );
}

/**
 * Mise en page de l'inscription et de la connexion : panneau bleu nuit à gauche sur ordinateur,
 * formulaire de 440 px à droite. Sur mobile, le formulaire seul.
 */
export function AuthShell({
  visual,
  title,
  subtitle,
  children,
  footer,
}: {
  visual: keyof typeof VISUALS;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-stretch lg:gap-16 lg:py-10">
      <AuthPanel visual={visual} />
      <div className="mx-auto flex w-full max-w-[440px] flex-col justify-center lg:py-6">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-2 text-sm leading-relaxed text-fg-muted">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 text-center text-sm text-fg-muted">{footer}</div>}
      </div>
    </div>
  );
}
