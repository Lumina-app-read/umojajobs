import { getTranslations } from 'next-intl/server';
import { type ReactNode } from 'react';
import { EarningsTabs } from '@/features/earnings/earnings-tabs';

/** « Mes revenus » : une seule rubrique pour le portefeuille, les commissions et les retraits. */
export default async function EarningsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('jobs.earnings');
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          {t('title')}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">{t('intro')}</p>
      </div>
      <EarningsTabs />
      {children}
    </div>
  );
}
