import { COMMISSION_STATUSES, PERMISSIONS } from '@opportinities/shared';
import { CircleCheck, Clock, HandCoins, Undo2, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/feedback';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { type SearchParams } from '@/features/jobs/routes';
import { readRegistryState } from '@/features/registry/query';
import { OfferCell, PersonCell, RegistryLayout } from '@/features/registry/registry-layout';
import { COMMISSION_TONE } from '@/features/registry/registry-tones';
import { getCommissionRegistry } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

const BASE = '/admin/commissions';

const STATUS_ICON = {
  pending: Clock,
  available: Wallet,
  paid: CircleCheck,
  reversed: Undo2,
} as const;

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.FINANCE_READ))) return {};
  const t = await getTranslations('registry.commissions');
  return { title: t('title') };
}

/** Registre des commissions des contributeurs, avec les totaux par état. */
export default async function AdminCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission(PERMISSIONS.FINANCE_READ);
  const state = readRegistryState(await searchParams, COMMISSION_STATUSES);
  const [t, format, data] = await Promise.all([
    getTranslations('registry.commissions'),
    getFormatter(),
    getCommissionRegistry({ q: state.q, status: state.status ?? undefined, page: state.page }),
  ]);
  const usd = (value: string) =>
    format.number(Number(value), { style: 'currency', currency: 'USD' });
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' });

  return (
    <RegistryLayout
      base={BASE}
      icon={HandCoins}
      title={t('title')}
      intro={t('intro')}
      searchHint={t('searchHint')}
      state={state}
      statuses={COMMISSION_STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))}
      data={data}
      stats={
        data && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {COMMISSION_STATUSES.map((value) => (
              <StatCard
                key={value}
                icon={STATUS_ICON[value]}
                label={t(`totals.${value}`)}
                value={usd(data.summary[value].amountUsd)}
                hint={t('count', { count: data.summary[value].count })}
              />
            ))}
          </div>
        )
      }
    >
      <Table className="min-w-[860px]">
        <thead>
          <tr>
            <Th>{t('date')}</Th>
            <Th>{t('contributor')}</Th>
            <Th>{t('offer')}</Th>
            <Th numeric>{t('base')}</Th>
            <Th numeric>{t('rate')}</Th>
            <Th numeric>{t('amount')}</Th>
            <Th>{t('state')}</Th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((item) => (
            <Tr key={item.id}>
              <Td className="whitespace-nowrap text-fg-muted">{date(item.createdAt)}</Td>
              <Td>
                <PersonCell person={item.contributor} />
              </Td>
              <Td>
                <OfferCell offer={item.offer} />
              </Td>
              <Td numeric>{usd(item.baseValueUsd)}</Td>
              <Td numeric>{format.number(Number(item.rate), { style: 'percent' })}</Td>
              <Td numeric className="font-semibold">
                {usd(item.amountUsd)}
              </Td>
              <Td>
                <Badge tone={COMMISSION_TONE[item.status]}>{t(`status.${item.status}`)}</Badge>
                {item.status === 'pending' && item.availableAt && (
                  <span className="mt-1 block text-xs whitespace-nowrap text-fg-subtle">
                    {t('availableOn', { date: date(item.availableAt) })}
                  </span>
                )}
                {item.reversedAt && (
                  <span className="mt-1 block text-xs whitespace-nowrap text-fg-subtle">
                    {t('reversedOn', { date: date(item.reversedAt) })}
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
