import { CREDIT_ORDER_STATUSES, PERMISSIONS } from '@opportinities/shared';
import { CreditCard, Landmark, Receipt, Timer, TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/feedback';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { type SearchParams } from '@/features/jobs/routes';
import { readRegistryState } from '@/features/registry/query';
import { PersonCell, RegistryLayout } from '@/features/registry/registry-layout';
import { ORDER_TONE } from '@/features/registry/registry-tones';
import { getPaymentRegistry } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

const BASE = '/admin/payments';

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.FINANCE_READ))) return {};
  const t = await getTranslations('registry.payments');
  return { title: t('title') };
}

/** Registre des recharges : commandes, paiements confirmés et règlements Chariow. */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission(PERMISSIONS.FINANCE_READ);
  const state = readRegistryState(await searchParams, CREDIT_ORDER_STATUSES);
  const [t, format, data] = await Promise.all([
    getTranslations('registry.payments'),
    getFormatter(),
    getPaymentRegistry({ q: state.q, status: state.status ?? undefined, page: state.page }),
  ]);
  const usd = (value: string) =>
    format.number(Number(value), { style: 'currency', currency: 'USD' });
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' });

  return (
    <RegistryLayout
      base={BASE}
      icon={CreditCard}
      title={t('title')}
      intro={t('intro')}
      searchHint={t('searchHint')}
      state={state}
      statuses={CREDIT_ORDER_STATUSES.map((value) => ({
        value,
        label: t(`status.${value}`),
      }))}
      data={data}
      stats={
        data && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={CreditCard}
              label={t('gross')}
              value={usd(data.summary.grossUsd)}
              hint={t('grossHint', { count: data.summary.paidOrders })}
            />
            <StatCard
              icon={Landmark}
              label={t('net')}
              value={usd(data.summary.settledNetUsd)}
              hint={t('netHint')}
            />
            <StatCard
              icon={Receipt}
              label={t('fees')}
              value={usd(data.summary.settledFeesUsd)}
              hint={t('feesHint')}
            />
            {data.summary.anomalies > 0 ? (
              <StatCard
                icon={TriangleAlert}
                label={t('anomalies')}
                value={format.number(data.summary.anomalies)}
                hint={t('anomaliesHint')}
                className="border-danger/40"
              />
            ) : (
              <StatCard
                icon={Timer}
                label={t('awaiting')}
                value={usd(data.summary.awaitingUsd)}
                hint={t('awaitingHint')}
              />
            )}
          </div>
        )
      }
    >
      <Table className="min-w-[860px]">
        <thead>
          <tr>
            <Th>{t('date')}</Th>
            <Th>{t('reference')}</Th>
            <Th>{t('buyer')}</Th>
            <Th>{t('pack')}</Th>
            <Th numeric>{t('amount')}</Th>
            <Th numeric>{t('settlement')}</Th>
            <Th>{t('state')}</Th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((item) => (
            <Tr key={item.id}>
              <Td className="whitespace-nowrap text-fg-muted">{date(item.createdAt)}</Td>
              <Td className="font-mono text-xs">
                <span className="block whitespace-nowrap">{item.reference}</span>
                {item.providerSaleId && (
                  <span className="block text-fg-subtle">{item.providerSaleId}</span>
                )}
              </Td>
              <Td>
                <PersonCell person={item.buyer} />
              </Td>
              <Td>
                <span className="block">{item.packName}</span>
                <span className="block text-xs text-fg-subtle">
                  {t('credits', { count: item.credits })}
                </span>
              </Td>
              <Td numeric className="font-semibold">
                {usd(item.priceUsd)}
              </Td>
              <Td numeric>
                {item.settlement ? (
                  <>
                    <span className="block">{usd(item.settlement.netUsd)}</span>
                    <span className="block text-xs text-fg-subtle">
                      {item.settlement.doneAt
                        ? t('feesOf', { fees: usd(item.settlement.feesUsd) })
                        : t('expected')}
                    </span>
                  </>
                ) : (
                  <span className="text-fg-subtle">{t('none')}</span>
                )}
              </Td>
              <Td>
                <Badge tone={ORDER_TONE[item.status]}>{t(`status.${item.status}`)}</Badge>
                {item.failureReason && (
                  <span className="mt-1 block max-w-56 text-xs text-fg-subtle">
                    {item.failureReason}
                  </span>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </RegistryLayout>
  );
}
