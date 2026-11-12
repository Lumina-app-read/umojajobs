import { Coins, History, PackageOpen } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/feedback';
import { BuyPackButton, OrderStatus } from '@/features/credits/buy-pack';
import { getCreditBalance, getCreditPacks } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.credits');
  return { title: t('title') };
}

/** Mes crédits : solde, recharge par pack (paiement Chariow) et historique des mouvements. */
export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const me = await requireUser();
  const t = await getTranslations('jobs.credits');
  const format = await getFormatter();
  const raw = (await searchParams).order;
  const reference = raw && /^CR-\d{8}-[0-9A-F]{8}$/.test(raw) ? raw : null;
  const [balance, packs] = await Promise.all([getCreditBalance(), getCreditPacks()]);
  const usd = (value: string) =>
    format.number(Number(value), { style: 'currency', currency: 'USD' });

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            {t('title')}
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">{t('intro')}</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-xs">
          <Coins className="size-5 text-brand" aria-hidden="true" />
          <div>
            <p className="text-xs text-fg-subtle">{t('balance')}</p>
            <p className="text-xl font-bold text-fg tabular-nums">
              {format.number(balance?.balance ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {reference && <OrderStatus reference={reference} />}

      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
          <PackageOpen className="size-4 text-brand" aria-hidden="true" />
          {t('packsTitle')}
        </h2>
        {packs.length === 0 ? (
          <Alert tone="info">{t('unavailable')}</Alert>
        ) : (
          <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="lift grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-xs"
              >
                <div>
                  <p className="text-sm font-medium text-fg-muted">{pack.name}</p>
                  <p className="mt-1 text-3xl font-bold tracking-[-0.02em] text-fg tabular-nums">
                    {t('creditsCount', { count: pack.credits })}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-brand">{usd(pack.priceUsd)}</p>
                </div>
                <BuyPackButton
                  pack={pack}
                  defaultPhone={me.phoneE164}
                  priceLabel={usd(pack.priceUsd)}
                />
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-fg-subtle">{t('note')}</p>
      </section>

      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
          <History className="size-4 text-brand" aria-hidden="true" />
          {t('historyTitle')}
        </h2>
        {!balance || balance.movements.length === 0 ? (
          <EmptyState icon={History} title={t('noHistory')} className="bg-surface py-10" />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
            {balance.movements.map((movement) => (
              <li key={movement.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-fg">{t(`movements.${movement.type}`)}</p>
                  <p className="text-xs text-fg-subtle">
                    {format.dateTime(new Date(movement.createdAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <span
                  className={
                    movement.quantity > 0
                      ? 'font-semibold text-success tabular-nums'
                      : 'font-semibold text-fg tabular-nums'
                  }
                >
                  {movement.quantity > 0 ? '+' : ''}
                  {format.number(movement.quantity)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
