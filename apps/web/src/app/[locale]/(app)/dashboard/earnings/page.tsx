import { ArrowDownToLine, Clock, Info, TrendingUp, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { StatCard } from '@/components/ui/feedback';
import { getWallet } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.earnings');
  return { title: t('title') };
}

/** Portefeuille du contributeur : soldes calculés par l'API, aucun calcul financier ici. */
export default async function WalletPage() {
  await requireUser();
  const t = await getTranslations('jobs.wallet');
  const format = await getFormatter();
  const wallet = await getWallet();

  const usd = (value: string) =>
    format.number(Number(value), { style: 'currency', currency: 'USD' });

  return (
    <div className="grid gap-6">
      {wallet === null ? (
        <Alert tone="error">{t('unavailable')}</Alert>
      ) : (
        <>
          <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Wallet}
              label={t('available')}
              value={usd(wallet.availableUsd)}
              hint={t('availableHint')}
            />
            <StatCard
              icon={Clock}
              label={t('pending')}
              value={usd(wallet.pendingUsd)}
              hint={t('pendingHint')}
            />
            <StatCard
              icon={TrendingUp}
              label={t('earned')}
              value={usd(wallet.totalEarnedUsd)}
              hint={t('earnedHint', { count: wallet.commissionCount })}
            />
            <StatCard
              icon={ArrowDownToLine}
              label={t('withdrawn')}
              value={usd(wallet.totalWithdrawnUsd)}
              hint={t('withdrawnHint')}
            />
          </div>

          <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
              <ArrowDownToLine className="size-4 text-brand" aria-hidden="true" />
              {t('withdrawTitle')}
            </h2>
            <p className="mt-2 text-sm text-fg-muted">
              {wallet.withdrawalMinUsd
                ? t('withdrawThreshold', { amount: usd(wallet.withdrawalMinUsd) })
                : t('withdrawNoThreshold')}
            </p>
            <div className="mt-4">
              <ButtonLink href="/dashboard/earnings/withdrawals" icon={ArrowDownToLine}>
                {t('withdrawCta')}
              </ButtonLink>
            </div>
          </section>

          <Alert tone="info" title={t('howTitle')}>
            <span className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {wallet.holdConfigured ? t('howBody') : t('howBodyPending')}
            </span>
          </Alert>
        </>
      )}
    </div>
  );
}
