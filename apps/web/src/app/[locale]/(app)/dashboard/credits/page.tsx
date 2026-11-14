import { Coins, History, PackageOpen } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { BuyPackButton, OrderStatus } from '@/features/credits/buy-pack';
import { getCreditBalance, getCreditPacks } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';
import { cn } from '@/lib/cn';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.credits');
  return { title: t('title') };
}

/** Mes crédits : solde, recharge par pack (paiement Chariow) et historique des mouvements. */
const REFERENCES = ['job_unlock', 'career_document_pass', 'ai_generation'] as const;

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
  /** Prix par crédit le plus bas : signale le pack le plus avantageux. */
  const bestPerCredit = Math.min(...packs.map((pack) => Number(pack.priceUsd) / pack.credits));
  const usd = (value: string) =>
    format.number(Number(value), { style: 'currency', currency: 'USD' });

  /** Ce que la consommation ou le remboursement concerne (export, génération IA…). */
  const referenceLabel = (reference: string | null) =>
    reference && (REFERENCES as readonly string[]).includes(reference)
      ? t(`movementReferences.${reference as (typeof REFERENCES)[number]}`)
      : null;

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
          <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {packs.map((pack) => {
              const perCredit = Number(pack.priceUsd) / pack.credits;
              const best = packs.length > 1 && perCredit === bestPerCredit;
              return (
                <li
                  key={pack.id}
                  className={cn(
                    'lift flex flex-col gap-4 rounded-xl border bg-surface p-4 shadow-xs',
                    best ? 'border-primary/40' : 'border-line',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm sm:text-[13px] font-medium text-fg-muted">{pack.name}</p>
                    {best && <Badge tone="primary">{t('bestValue')}</Badge>}
                  </div>
                  <div>
                    <p className="flex items-baseline gap-1.5 text-fg">
                      <span className="text-2xl font-bold tracking-[-0.02em] tabular-nums">
                        {format.number(pack.credits)}
                      </span>
                      <span className="text-sm text-fg-muted">{t('creditsUnit')}</span>
                    </p>
                    <p className="mt-1 text-sm text-fg">
                      <span className="font-semibold tabular-nums">{usd(pack.priceUsd)}</span>
                      <span className="text-fg-subtle">
                        {' · '}
                        {t('perCredit', { price: usd(String(perCredit)) })}
                      </span>
                    </p>
                  </div>
                  <div className="mt-auto">
                    <BuyPackButton
                      pack={pack}
                      defaultPhone={me.phoneE164}
                      priceLabel={usd(pack.priceUsd)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
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
                  <p className="text-sm font-medium text-fg">
                    {[t(`movements.${movement.type}`), referenceLabel(movement.referenceType)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
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
