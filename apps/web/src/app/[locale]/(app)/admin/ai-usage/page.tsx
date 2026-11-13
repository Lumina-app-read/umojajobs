import {
  type AiGenerationAction,
  type CareerDocumentType,
  PERMISSIONS,
} from '@opportinities/shared';
import { Coins, Cpu, ReceiptText, Sparkles, Wallet, Waypoints } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { EmptyState, StatCard } from '@/components/ui/feedback';
import { SegmentedLinks } from '@/features/admin/segmented-links';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { getAiUsage } from '@/lib/api/server';
import { requirePermission } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.admin.aiUsage');
  return { title: t('title') };
}

const PERIODS = [7, 30, 90] as const;

/**
 * Usage de l'IA du Career Studio : générations, crédits encaissés (recette) et coûts estimés
 * d'OpenAI, distincts. Agrégats seulement : aucun contenu de document ni aucune identité.
 */
export default async function AdminAiUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requirePermission(PERMISSIONS.FINANCE_READ);
  const { days: raw } = await searchParams;
  const days = PERIODS.find((value) => String(value) === raw) ?? 30;
  const [t, tTypes, format, usage] = await Promise.all([
    getTranslations('common.admin.aiUsage'),
    getTranslations('studio.list.types'),
    getFormatter(),
    getAiUsage(days),
  ]);
  const number = (value: number) => format.number(value);
  const usd = (value: string) =>
    format.number(Number(value), { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });

  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
            <Sparkles className="size-6 text-brand" aria-hidden="true" />
            {t('title')}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{t('intro')}</p>
        </div>
        <SegmentedLinks
          label={t('period')}
          current={String(days)}
          options={PERIODS.map((value) => ({
            value: String(value),
            label: t('days', { count: value }),
            href: `/admin/ai-usage?days=${value}`,
          }))}
        />
      </div>

      {usage === null ? (
        <Alert tone="error">{t('unavailable')}</Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={Sparkles}
              label={t('generations')}
              value={number(usage.generations.total)}
              hint={t('generationsHint', {
                succeeded: number(usage.generations.succeeded),
                failed: number(usage.generations.failed),
              })}
            />
            <StatCard
              icon={Coins}
              label={t('credits')}
              value={number(usage.credits.net)}
              hint={t('creditsHint', {
                charged: number(usage.credits.charged),
                refunded: number(usage.credits.refunded),
              })}
            />
            <StatCard icon={Wallet} label={t('revenue')} value={usd(usage.credits.revenueUsd)} />
            <StatCard
              icon={ReceiptText}
              label={t('cost')}
              value={
                usage.openai.estimatedCostUsd === null
                  ? t('costMissing')
                  : usd(usage.openai.estimatedCostUsd)
              }
              hint={usage.openai.estimatedCostUsd === null ? t('costMissingHint') : undefined}
            />
            <StatCard
              icon={Cpu}
              label={t('tokens')}
              value={number(usage.openai.inputTokens + usage.openai.outputTokens)}
              hint={t('tokensHint', {
                input: number(usage.openai.inputTokens),
                output: number(usage.openai.outputTokens),
              })}
            />
            <StatCard
              icon={Waypoints}
              label={t('requests')}
              value={number(usage.openai.requests)}
              hint={t('requestsHint', { failed: number(usage.openai.failedRequests) })}
            />
          </div>

          {usage.generations.total === 0 ? (
            <EmptyState icon={Sparkles} title={t('empty')} className="bg-surface py-12" />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="grid gap-3" aria-labelledby="ai-by-type">
                <h2 id="ai-by-type" className="text-[15px] font-semibold text-fg">
                  {t('byType')}
                </h2>
                <Table>
                  <thead>
                    <Tr>
                      <Th>{t('type')}</Th>
                      <Th className="text-right">{t('count')}</Th>
                      <Th className="text-right">{t('netCredits')}</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {usage.byDocumentType.map((row) => (
                      <Tr key={row.documentType}>
                        <Td>{tTypes(row.documentType as CareerDocumentType)}</Td>
                        <Td className="text-right tabular-nums">{number(row.generations)}</Td>
                        <Td className="text-right tabular-nums">{number(row.netCredits)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </section>
              <section className="grid gap-3" aria-labelledby="ai-by-action">
                <h2 id="ai-by-action" className="text-[15px] font-semibold text-fg">
                  {t('byAction')}
                </h2>
                <Table>
                  <thead>
                    <Tr>
                      <Th>{t('action')}</Th>
                      <Th className="text-right">{t('count')}</Th>
                      <Th className="text-right">{t('netCredits')}</Th>
                    </Tr>
                  </thead>
                  <tbody>
                    {usage.byAction.map((row) => (
                      <Tr key={row.action}>
                        <Td>{t(`actions.${row.action as AiGenerationAction}`)}</Td>
                        <Td className="text-right tabular-nums">{number(row.generations)}</Td>
                        <Td className="text-right tabular-nums">{number(row.netCredits)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
