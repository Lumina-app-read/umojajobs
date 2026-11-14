import { PERMISSIONS, WITHDRAWAL_STATUSES, type WithdrawalStatus } from '@opportinities/shared';
import { ArrowDownToLine, ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { WITHDRAWAL_TONE } from '@/features/withdrawals/status';
import { Link } from '@/i18n/navigation';
import { getAdminWithdrawals } from '@/lib/api/server';
import { requirePermission } from '@/lib/auth-guard';
import { cn } from '@/lib/cn';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('jobs.withdrawals.admin');
  return { title: t('title') };
}

const isStatus = (value: unknown): value is WithdrawalStatus =>
  (WITHDRAWAL_STATUSES as readonly unknown[]).includes(value);

/** File des retraits : en cours par défaut, filtrable par état. */
export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requirePermission(PERMISSIONS.FINANCE_MANAGE);
  const t = await getTranslations('jobs.withdrawals');
  const format = await getFormatter();
  const raw = (await searchParams).status;
  const status = isStatus(raw) ? raw : null;
  const rows = await getAdminWithdrawals(status);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          <ArrowDownToLine className="size-6 text-brand" aria-hidden="true" />
          {t('admin.title')}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">{t('admin.intro')}</p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label={t('admin.filter')}>
        {[null, ...WITHDRAWAL_STATUSES].map((value) => (
          <Link
            key={value ?? 'open'}
            href={value ? `/admin/withdrawals?status=${value}` : '/admin/withdrawals'}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm sm:text-[13px] font-medium transition-colors',
              value === status
                ? 'border-primary bg-primary-soft text-brand'
                : 'border-line text-fg-muted hover:bg-surface-2',
            )}
          >
            {value ? t(`status.${value}`) : t('admin.open')}
          </Link>
        ))}
      </nav>

      {rows === null ? (
        <Alert tone="error">{t('unavailable')}</Alert>
      ) : rows.length === 0 ? (
        <EmptyState icon={ArrowDownToLine} title={t('admin.empty')} className="bg-surface py-14" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('admin.date')}</Th>
              <Th>{t('admin.user')}</Th>
              <Th>{t('method')}</Th>
              <Th numeric>{t('amount')}</Th>
              <Th>{t('admin.state')}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td className="whitespace-nowrap text-fg-muted">
                  {format.dateTime(new Date(row.createdAt), { dateStyle: 'medium' })}
                </Td>
                <Td>
                  <span className="font-medium">{row.user.name}</span>
                  <span className="block text-xs text-fg-subtle">{row.user.email}</span>
                </Td>
                <Td className="text-fg-muted">
                  {row.method.provider} {row.method.maskedAccount}
                </Td>
                <Td numeric className="font-semibold">
                  {format.number(Number(row.amountUsd), { style: 'currency', currency: 'USD' })}
                </Td>
                <Td>
                  <Badge tone={WITHDRAWAL_TONE[row.status]}>{t(`status.${row.status}`)}</Badge>
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/admin/withdrawals/${row.id}`}
                    className="inline-flex items-center gap-1 text-sm sm:text-[13px] font-medium text-brand hover:underline"
                  >
                    {t('admin.open_detail')}
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </Link>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
