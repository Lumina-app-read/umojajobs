import { flagEmoji } from '@opportinities/shared';
import { ArrowDownToLine, Banknote, History, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { WITHDRAWAL_TONE } from '@/features/withdrawals/status';
import { AddMethodButton, RequestWithdrawalForm } from '@/features/withdrawals/withdrawal-forms';
import { getCountries, getMyWithdrawals, getWallet, getWithdrawalMethods } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.earnings.tabs');
  return { title: t('withdrawals') };
}

/** Retraits : moyens de paiement, demande (montant réservé immédiatement) et historique. */
export default async function WithdrawalsPage() {
  const me = await requireUser();
  const t = await getTranslations('jobs.withdrawals');
  const format = await getFormatter();
  const [wallet, methods, withdrawals, countries] = await Promise.all([
    getWallet(),
    getWithdrawalMethods(),
    getMyWithdrawals(),
    getCountries().catch(() => []),
  ]);
  const usd = (value: string) =>
    format.number(Number(value), { style: 'currency', currency: 'USD' });
  const open = (withdrawals ?? []).some((entry) =>
    ['pending', 'under_review', 'approved', 'processing'].includes(entry.status),
  );
  const canRequest =
    wallet !== null &&
    wallet.withdrawalMinUsd !== null &&
    Number(wallet.availableUsd) >= Number(wallet.withdrawalMinUsd);

  return (
    <div className="grid gap-6">
      <Card icon={ArrowDownToLine} title={t('requestTitle')}>
        {wallet === null ? (
          <Alert tone="error">{t('unavailable')}</Alert>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm text-fg-muted">
              {t('availableNow', { amount: usd(wallet.availableUsd) })}
              {wallet.withdrawalMinUsd &&
                ` ${t('minimum', { amount: usd(wallet.withdrawalMinUsd) })}`}
            </p>
            {open ? (
              <Alert tone="info">{t('openRequest')}</Alert>
            ) : (methods ?? []).length === 0 ? (
              <Alert tone="info">{t('needMethod')}</Alert>
            ) : canRequest ? (
              <RequestWithdrawalForm
                methods={methods ?? []}
                availableUsd={Number(wallet.availableUsd).toFixed(2)}
                minimumUsd={wallet.withdrawalMinUsd}
              />
            ) : (
              <Alert tone="info">{t('belowMinimum')}</Alert>
            )}
          </div>
        )}
      </Card>

      <Card
        icon={Banknote}
        title={t('methodsTitle')}
        action={<AddMethodButton countries={countries} defaultCountry={me.countryIso2} />}
      >
        {(methods ?? []).length === 0 ? (
          <p className="text-sm text-fg-muted">{t('noMethod')}</p>
        ) : (
          <ul className="divide-y divide-line">
            {(methods ?? []).map((method) => (
              <li key={method.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm text-fg">
                  <span aria-hidden="true">{flagEmoji(method.countryIso2)} </span>
                  <span className="font-medium">{method.provider}</span>
                  <span className="ml-2 text-fg-subtle">{method.maskedAccount}</span>
                </span>
                <Badge tone="neutral">{t(`types.${method.type}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card icon={History} title={t('historyTitle')}>
        {(withdrawals ?? []).length === 0 ? (
          <EmptyState icon={History} title={t('noHistory')} className="py-8" />
        ) : (
          <ul className="divide-y divide-line">
            {(withdrawals ?? []).map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-fg tabular-nums">
                    {usd(entry.amountUsd)}
                  </p>
                  <p className="text-xs text-fg-subtle">
                    {format.dateTime(new Date(entry.createdAt), { dateStyle: 'medium' })} ·{' '}
                    {entry.method.provider} {entry.method.maskedAccount}
                  </p>
                  {entry.rejectionReason && (
                    <p className="mt-1 text-xs text-danger">{entry.rejectionReason}</p>
                  )}
                  {entry.payoutReference && (
                    <p className="mt-1 text-xs text-fg-muted">
                      {t('reference', { reference: entry.payoutReference })}
                    </p>
                  )}
                </div>
                <Badge tone={WITHDRAWAL_TONE[entry.status]}>{t(`status.${entry.status}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
          <Icon className="size-4 text-brand" aria-hidden="true" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
