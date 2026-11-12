'use client';

import { ArrowDownToLine, HandCoins, type LucideIcon, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const TABS: { key: 'overview' | 'commissions' | 'withdrawals'; href: string; icon: LucideIcon }[] =
  [
    { key: 'overview', href: '/dashboard/earnings', icon: Wallet },
    { key: 'commissions', href: '/dashboard/earnings/commissions', icon: HandCoins },
    { key: 'withdrawals', href: '/dashboard/earnings/withdrawals', icon: ArrowDownToLine },
  ];

/** Onglets de « Mes revenus » : aperçu, commissions et retraits. */
export function EarningsTabs() {
  const t = useTranslations('jobs.earnings.tabs');
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line" aria-label={t('label')}>
      {TABS.map(({ key, href, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-brand'
                : 'border-transparent text-fg-muted hover:border-line-strong hover:text-fg',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
