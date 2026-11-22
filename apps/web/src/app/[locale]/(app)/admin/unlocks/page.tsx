import { PERMISSIONS } from '@opportinities/shared';
import { Coins, HandCoins, Unlock, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/feedback';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { type SearchParams } from '@/features/jobs/routes';
import { readRegistryState } from '@/features/registry/query';
import { OfferCell, PersonCell, RegistryLayout } from '@/features/registry/registry-layout';
import { COMMISSION_TONE } from '@/features/registry/registry-tones';
import { getUnlockRegistry } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

const BASE = '/admin/unlocks';

export async function generateMetadata(): Promise<Metadata> {
  if (!(await hasPermission(PERMISSIONS.FINANCE_READ))) return {};
  const t = await getTranslations('registry.unlocks');
  return { title: t('title') };
}

/** Registre des déverrouillages : candidat, offre, crédits et commission née. */
export default async function AdminUnlocksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePermission(PERMISSIONS.FINANCE_READ);
  const state = readRegistryState(await searchParams, []);
  const [t, tStatus, format, data] = await Promise.all([
    getTranslations('registry.unlocks'),
    getTranslations('registry.commissions.status'),
    getFormatter(),
    getUnlockRegistry({ q: state.q, page: state.page }),
  ]);
  const usd = (value: string) =>
    format.number(Number(value), { style: 'currency', currency: 'USD' });
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' });

  return (
    <RegistryLayout
      base={BASE}
      icon={Unlock}
      title={t('title')}
      intro={t('intro')}
      searchHint={t('searchHint')}
      state={state}
      data={data}
      stats={
        data && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Unlock}
              label={t('count')}
              value={format.number(data.summary.unlocks)}
            />
            <StatCard
              icon={Coins}
              label={t('creditsTotal')}
              value={format.number(data.summary.credits)}
            />
            <StatCard
              icon={Wallet}
              label={t('value')}
              value={usd(data.summary.valueUsd)}
              hint={t('valueHint')}
            />
            <StatCard
              icon={HandCoins}
              label={t('withCommission')}
              value={format.number(data.summary.withCommission)}
              hint={t('withCommissionHint')}
            />
          </div>
        )
      }
    >
      <Table className="min-w-[860px]">
        <thead>
          <tr>
            <Th>{t('date')}</Th>
            <Th>{t('candidate')}</Th>
            <Th>{t('offer')}</Th>
            <Th numeric>{t('credits')}</Th>
            <Th numeric>{t('valueColumn')}</Th>
            <Th numeric>{t('commission')}</Th>
          </tr>
        </thead>
        <tbody>
          {data?.items.map((item) => (
            <Tr key={item.id}>
              <Td className="whitespace-nowrap text-fg-muted">{date(item.createdAt)}</Td>
              <Td>
                <PersonCell person={item.candidate} />
              </Td>
              <Td>
                <OfferCell offer={item.offer} />
              </Td>
              <Td numeric>{format.number(item.credits)}</Td>
              <Td numeric>{usd(item.valueUsd)}</Td>
              <Td numeric>
                {item.commission ? (
                  <span className="inline-flex flex-col items-end gap-1">
                    <span className="font-semibold">{usd(item.commission.amountUsd)}</span>
                    <Badge tone={COMMISSION_TONE[item.commission.status]}>
                      {tStatus(item.commission.status)}
                    </Badge>
                  </span>
                ) : (
                  <span className="text-fg-subtle">{t('none')}</span>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </RegistryLayout>
  );
}
