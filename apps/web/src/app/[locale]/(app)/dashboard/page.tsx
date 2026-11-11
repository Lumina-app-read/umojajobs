import {
  ArrowRight,
  Bell,
  Briefcase,
  CircleCheck,
  Coins,
  Files,
  HandCoins,
  type LucideIcon,
  Search,
  SquarePlus,
  Share2,
  Sparkles,
  Unlock,
} from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState, StatCard } from '@/components/ui/feedback';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.app.nav');
  return { title: t('overview') };
}

/**
 * Vue d'ensemble. Aucune donnée inventée : tant que le portefeuille, les offres et le Career Studio
 * n'existent pas, les indicateurs affichent les valeurs réelles du compte (zéro, aucun) et les
 * listes un état vide explicite.
 */
export default async function DashboardOverviewPage() {
  const user = await requireUser();
  const t = await getTranslations('common.app');
  const format = await getFormatter();

  const steps: { icon: LucideIcon; label: string; done: boolean; href?: string }[] = [
    { icon: CircleCheck, label: t('overview.stepAccount'), done: true },
    { icon: Search, label: t('overview.stepExplore'), done: false },
    { icon: Sparkles, label: t('overview.stepStudio'), done: false },
    { icon: Share2, label: t('overview.stepShare'), done: false, href: '/dashboard/publish' },
  ];
  // Valeurs réelles du compte : aucun crédit, offre, gain ni document tant que ces modules
  // (phases 3 et 4) ne sont pas ouverts. Elles seront lues dans le portefeuille ensuite.
  const stats: { icon: LucideIcon; label: string; value: string; hint: string }[] = [
    {
      icon: Coins,
      label: t('overview.credits'),
      value: format.number(0),
      hint: t('overview.creditsHint'),
    },
    {
      icon: Unlock,
      label: t('overview.unlocked'),
      value: format.number(0),
      hint: t('overview.unlockedHint'),
    },
    {
      icon: HandCoins,
      label: t('overview.earnings'),
      value: format.number(0, { style: 'currency', currency: 'USD' }),
      hint: t('overview.earningsHint'),
    },
    {
      icon: Files,
      label: t('overview.documents'),
      value: t('overview.documentsNone'),
      hint: t('overview.documentsHint'),
    },
  ];

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            {t('overview.greeting', { firstName: user.firstName })}
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">{t('overview.intro')}</p>
        </div>
        <ButtonLink href="/dashboard/publish" size="lg" icon={SquarePlus}>
          {t('overview.primaryAction')}
        </ButtonLink>
      </div>

      <section
        aria-labelledby="getting-started"
        className="rounded-xl border border-line bg-surface p-5 shadow-xs"
      >
        <h2 id="getting-started" className="text-base font-semibold text-fg">
          {t('overview.gettingStarted')}
        </h2>
        <ol className="stagger mt-4 grid gap-2 sm:grid-cols-2">
          {steps.map(({ icon: Icon, label, done, href }) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-3.5 py-3"
            >
              <Icon
                className={done ? 'size-5 text-success' : 'size-5 text-fg-subtle'}
                aria-hidden="true"
              />
              <span className="flex-1 text-sm font-medium text-fg">{label}</span>
              {href && !done ? (
                <ButtonLink href={href} variant="secondary" size="sm" trailingIcon={ArrowRight}>
                  {t('overview.start')}
                </ButtonLink>
              ) : (
                <Badge tone={done ? 'success' : 'neutral'}>
                  {done ? t('overview.done') : t('soon.badge')}
                </Badge>
              )}
            </li>
          ))}
        </ol>
      </section>

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ icon, label, value, hint }) => (
          <StatCard key={label} icon={icon} label={label} value={value} hint={hint} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="recommended">
          <h2 id="recommended" className="mb-3 text-base font-semibold text-fg">
            {t('overview.recommended')}
          </h2>
          <EmptyState
            icon={Briefcase}
            title={t('overview.recommendedEmpty')}
            description={t('overview.recommendedEmptyBody')}
            className="bg-surface py-12"
          />
        </section>
        <section aria-labelledby="notifications">
          <h2 id="notifications" className="mb-3 text-base font-semibold text-fg">
            {t('overview.notifications')}
          </h2>
          <EmptyState
            icon={Bell}
            title={t('overview.notificationsEmpty')}
            description={t('overview.notificationsEmptyBody')}
            className="bg-surface py-12"
          />
        </section>
      </div>
    </div>
  );
}
