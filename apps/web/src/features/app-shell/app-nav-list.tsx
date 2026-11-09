'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { APP_NAV, isActive } from './app-nav';

/**
 * Liste de navigation groupée, partagée par la barre latérale (dense : liens de 32 px) et le
 * tiroir mobile (liens de 40 px, adaptés au toucher).
 */
export function AppNavList({
  onNavigate,
  dense = false,
}: {
  onNavigate?: () => void;
  dense?: boolean;
}) {
  const t = useTranslations('common.app');
  const pathname = usePathname();

  return (
    <nav aria-label={t('nav.label')} className="grid gap-4">
      {APP_NAV.map((group) => (
        <div key={group.key}>
          {group.key !== 'main' && (
            <p className="mb-1 px-3 text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
              {t(`nav.groups.${group.key}`)}
            </p>
          )}
          <ul className="grid gap-0.5">
            {group.items.map(({ key, href, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={key}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                      dense ? 'h-8' : 'h-10',
                      active
                        ? 'bg-primary-soft text-brand'
                        : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden="true" />
                    <span className="truncate">{t(`nav.${key}`)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
