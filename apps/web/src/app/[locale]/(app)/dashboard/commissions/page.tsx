import { type CommissionStatus } from '@opportinities/shared';
import { HandCoins, Megaphone, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/ui/feedback';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { Link } from '@/i18n/navigation';
import { getCommissions } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.app.nav');
  return { title: t('commissions') };
}

const TONE: Record<CommissionStatus, BadgeTone> = {
  pending: 'warning',
  available: 'success',
  paid: 'primary',
  reversed: 'danger',
};

/** Commissions du contributeur, une ligne par déverrouillage éligible de ses offres. */
export default async function CommissionsPage() {
  await requireUser();
  const t = await getTranslations('jobs.commissions');
  const format = await getFormatter();
  const commissions = await getCommissions();

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            {t('title')}
          </h1>
          <p className="mt-1.5 text-sm text-fg-muted">{t('intro')}</p>
        </div>
        <ButtonLink href="/dashboard/wallet" variant="secondary" icon={Wallet}>
          {t('seeWallet')}
        </ButtonLink>
      </div>

      {commissions === null ? (
        <Alert tone="error">{t('unavailable')}</Alert>
      ) : commissions.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={t('empty')}
          description={t('emptyBody')}
          className="bg-surface py-14"
          action={
            <ButtonLink href="/dashboard/publish" icon={Megaphone}>
              {t('share')}
            </ButtonLink>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('columns.date')}</Th>
              <Th>{t('columns.offer')}</Th>
              <Th numeric>{t('columns.amount')}</Th>
              <Th>{t('columns.status')}</Th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((commission) => (
              <Tr key={commission.id}>
                <Td className="whitespace-nowrap text-fg-muted">
                  {format.dateTime(new Date(commission.createdAt), { dateStyle: 'medium' })}
                </Td>
                <Td className="font-medium">
                  {commission.offer.slug ? (
                    <Link
                      href={`/dashboard/jobs/${commission.offer.slug}`}
                      className="hover:text-brand hover:underline"
                    >
                      {commission.offer.title}
                    </Link>
                  ) : (
                    commission.offer.title
                  )}
                </Td>
                <Td numeric className="font-semibold">
                  {format.number(Number(commission.amountUsd), {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 4,
                  })}
                </Td>
                <Td>
                  <Badge tone={TONE[commission.status]}>{t(`status.${commission.status}`)}</Badge>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
