import {
  FINANCIAL_SETTING_UNITS,
  type FinancialSettingKey,
  PERMISSIONS,
} from '@opportinities/shared';
import { BadgePercent, Coins, Gift, PackageOpen, SlidersHorizontal } from 'lucide-react';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { CreditGrantForm } from '@/features/finance/credit-grant-form';
import { ValueEditor } from '@/features/finance/value-editor';
import { PackEditor } from '@/features/finance/pack-editor';
import { getAdminCreditPacks, getFinancialSettings, getServiceCosts } from '@/lib/api/server';
import { hasPermission, requirePermission } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common.admin.finance');
  return { title: t('title') };
}

/** Tarifs et paramètres financiers (CLAUDE.md §10 et §15) : consultation, modification, dotations. */
export default async function AdminFinancePage() {
  await requirePermission(PERMISSIONS.FINANCE_READ);
  const t = await getTranslations('common.admin.finance');
  const format = await getFormatter();
  const canManage = await hasPermission(PERMISSIONS.FINANCE_MANAGE);
  const [settings, costs, packs] = await Promise.all([
    getFinancialSettings(),
    getServiceCosts(),
    getAdminCreditPacks(),
  ]);

  const settingValue = (key: FinancialSettingKey) => {
    const value = settings?.find((setting) => setting.key === key)?.value;
    return value === undefined || value === null ? null : Number(value);
  };
  const unitValueUsd = settingValue('credit_unit_value_usd');
  const feeRate = settingValue('payment_fee_rate');

  /** Affichage d'une valeur selon son unité (la valeur exacte reste celle de l'API). */
  const display = (key: FinancialSettingKey, value: string): string => {
    const unit = FINANCIAL_SETTING_UNITS[key];
    if (unit === 'rate') return format.number(Number(value), { style: 'percent' });
    if (unit === 'days') return `${format.number(Number(value))} ${t('units.days')}`;
    return format.number(Number(value), {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 6,
    });
  };
  const since = (date: string | null) =>
    date ? format.dateTime(new Date(date), { dateStyle: 'medium' }) : null;

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          <BadgePercent className="size-6 text-brand" aria-hidden="true" />
          {t('title')}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-fg-muted">{t('intro')}</p>
      </div>
      {!canManage && <Alert tone="info">{t('readOnly')}</Alert>}

      <Section icon={SlidersHorizontal} title={t('settingsTitle')}>
        {settings === null ? (
          <Alert tone="error">{t('notSetHint')}</Alert>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('columns.setting')}</Th>
                <Th>{t('columns.value')}</Th>
                <Th>{t('columns.since')}</Th>
                <Th>{t('columns.by')}</Th>
                {canManage && <Th />}
              </tr>
            </thead>
            <tbody>
              {settings.map((setting) => (
                <Tr key={setting.key}>
                  <Td className="font-medium">{t(`settings.${setting.key}`)}</Td>
                  <Td>
                    {setting.value === null ? (
                      <span title={t('notSetHint')}>
                        <Badge tone="warning">{t('notSet')}</Badge>
                      </span>
                    ) : (
                      <span className="font-semibold tabular-nums">
                        {display(setting.key, setting.value)}
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-fg-muted">
                    {since(setting.effectiveFrom) ?? '·'}
                  </Td>
                  <Td className="text-fg-muted" title={setting.reason ?? undefined}>
                    {setting.changedBy?.name ?? (setting.value === null ? '·' : t('seed'))}
                  </Td>
                  {canManage && (
                    <Td className="text-right">
                      <ValueEditor
                        kind="setting"
                        target={setting.key}
                        name={t(`settings.${setting.key}`)}
                        current={setting.value}
                        placeholder={t(`placeholders.${FINANCIAL_SETTING_UNITS[setting.key]}`)}
                        unit={t(`units.${FINANCIAL_SETTING_UNITS[setting.key]}`)}
                      />
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section icon={Coins} title={t('costsTitle')}>
        {costs === null ? (
          <Alert tone="error">{t('notSetHint')}</Alert>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('columns.service')}</Th>
                <Th>{t('columns.credits')}</Th>
                <Th>{t('columns.since')}</Th>
                <Th>{t('columns.by')}</Th>
                {canManage && <Th />}
              </tr>
            </thead>
            <tbody>
              {costs.map((cost) => (
                <Tr key={cost.service}>
                  <Td className="font-medium">{t(`services.${cost.service}`)}</Td>
                  <Td>
                    {cost.credits === null ? (
                      <Badge tone="warning">{t('notSet')}</Badge>
                    ) : (
                      <span className="font-semibold tabular-nums">
                        {format.number(cost.credits)}
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-fg-muted">
                    {since(cost.effectiveFrom) ?? '·'}
                  </Td>
                  <Td className="text-fg-muted" title={cost.reason ?? undefined}>
                    {cost.changedBy?.name ?? (cost.credits === null ? '·' : t('seed'))}
                  </Td>
                  {canManage && (
                    <Td className="text-right">
                      <ValueEditor
                        kind="cost"
                        target={cost.service}
                        name={t(`services.${cost.service}`)}
                        current={cost.credits === null ? null : String(cost.credits)}
                        placeholder={t('grant.creditsPlaceholder')}
                        unit={t('columns.credits').toLowerCase()}
                      />
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section icon={PackageOpen} title={t('packs.title')} intro={t('packs.intro')}>
        {canManage && (
          <div>
            <PackEditor unitValueUsd={unitValueUsd} feeRate={feeRate} />
          </div>
        )}
        {packs === null || packs.length === 0 ? (
          <p className="text-sm text-fg-muted">{t('packs.empty')}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t('packs.name')}</Th>
                <Th numeric>{t('packs.credits')}</Th>
                <Th numeric>{t('packs.price')}</Th>
                <Th>{t('packs.productId')}</Th>
                <Th>{t('packs.state')}</Th>
                {canManage && <Th />}
              </tr>
            </thead>
            <tbody>
              {packs.map((pack) => (
                <Tr key={pack.id}>
                  <Td className="font-medium">
                    {pack.name}
                    <span className="block text-xs text-fg-subtle">{pack.sku}</span>
                  </Td>
                  <Td numeric>{format.number(pack.credits)}</Td>
                  <Td numeric>
                    {format.number(Number(pack.priceUsd), { style: 'currency', currency: 'USD' })}
                  </Td>
                  <Td className="font-mono text-xs text-fg-muted">
                    {pack.chariowProductId ?? t('packs.noProduct')}
                  </Td>
                  <Td>
                    <Badge tone={pack.isActive && pack.chariowProductId ? 'success' : 'neutral'}>
                      {pack.isActive && pack.chariowProductId
                        ? t('packs.onSale')
                        : t('packs.offSale')}
                    </Badge>
                  </Td>
                  {canManage && (
                    <Td className="text-right">
                      <PackEditor pack={pack} unitValueUsd={unitValueUsd} feeRate={feeRate} />
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {canManage && (
        <Section icon={Gift} title={t('grant.title')} intro={t('grant.intro')}>
          <div className="rounded-xl border border-line bg-surface p-5 shadow-xs">
            <CreditGrantForm />
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  intro,
  children,
}: {
  icon: typeof Coins;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
          <Icon className="size-4 text-brand" aria-hidden="true" />
          {title}
        </h2>
        {intro && <p className="mt-1 text-sm sm:text-[13px] text-fg-muted">{intro}</p>}
      </div>
      {children}
    </section>
  );
}
