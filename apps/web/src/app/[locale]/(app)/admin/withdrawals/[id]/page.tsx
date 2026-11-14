import { flagEmoji, PERMISSIONS } from '@opportinities/shared';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { WithdrawalDecisionPanel } from '@/features/withdrawals/decision-panel';
import { WITHDRAWAL_TONE } from '@/features/withdrawals/status';
import { getAdminWithdrawal } from '@/lib/api/server';
import { requirePermission } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.withdrawals.admin');
  return { title: t('title') };
}

/** Détail d'une demande : bénéficiaire, coordonnées de versement, historique et décision. */
export default async function AdminWithdrawalPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const withdrawal = await getAdminWithdrawal(id);
  if (!withdrawal) notFound();
  const t = await getTranslations('jobs.withdrawals');
  const format = await getFormatter();
  const when = (date: string) =>
    format.dateTime(new Date(date), { dateStyle: 'medium', timeStyle: 'short' });

  const rows: [string, string][] = [
    [t('admin.user'), `${withdrawal.user.name} (${withdrawal.user.email})`],
    [t('methodType'), t(`types.${withdrawal.method.type}`)],
    [t('country'), `${flagEmoji(withdrawal.method.countryIso2)} ${withdrawal.method.countryIso2}`],
    [
      withdrawal.method.type === 'mobile_money' ? t('operator') : t('bank'),
      withdrawal.method.provider,
    ],
    [t('holder'), withdrawal.accountHolder],
    [
      withdrawal.method.type === 'mobile_money' ? t('phone') : t('accountNumber'),
      withdrawal.accountNumber,
    ],
  ];
  if (withdrawal.approvedBy) rows.push([t('admin.approvedBy'), withdrawal.approvedBy.name]);
  if (withdrawal.paidBy) rows.push([t('admin.paidBy'), withdrawal.paidBy.name]);
  if (withdrawal.payoutReference) rows.push([t('admin.reference'), withdrawal.payoutReference]);

  return (
    <div className="grid gap-6">
      <div>
        <ButtonLink href="/admin/withdrawals" variant="ghost" size="sm" icon={ArrowLeft}>
          {t('admin.back')}
        </ButtonLink>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg tabular-nums sm:text-[28px]">
            {format.number(Number(withdrawal.amountUsd), { style: 'currency', currency: 'USD' })}
          </h1>
          <Badge tone={WITHDRAWAL_TONE[withdrawal.status]}>
            {t(`status.${withdrawal.status}`)}
          </Badge>
          {withdrawal.dualApprovalRequired && (
            <Badge tone="warning" icon={ShieldCheck}>
              {t('admin.dual')}
            </Badge>
          )}
        </div>
      </div>

      {withdrawal.rejectionReason && <Alert tone="error">{withdrawal.rejectionReason}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="grid gap-6">
          <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <h2 className="mb-4 text-base font-semibold text-fg">{t('admin.payout')}</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-fg-subtle">{label}</dt>
                  <dd className="text-sm font-medium break-all text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <h2 className="mb-4 text-base font-semibold text-fg">{t('admin.history')}</h2>
            <ol className="grid gap-3">
              {withdrawal.events.map((event, index) => (
                <li key={index} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <Badge tone={WITHDRAWAL_TONE[event.toStatus]}>
                      {t(`status.${event.toStatus}`)}
                    </Badge>
                    {event.note && (
                      <p className="mt-1 text-sm sm:text-[13px] text-fg-muted">{event.note}</p>
                    )}
                  </div>
                  <span className="text-xs whitespace-nowrap text-fg-subtle">
                    {when(event.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <WithdrawalDecisionPanel withdrawal={withdrawal} currentUserId={me.id} />
      </div>
    </div>
  );
}
