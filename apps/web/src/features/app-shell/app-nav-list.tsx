'use client';

import { type LucideIcon } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { isActive } from './app-nav';

/** Rubrique prête à afficher (libellé déjà traduit). */
export interface NavItemView {
  key: string;
  href: string;
  icon: LucideIcon;
  label: string;
}

export interface NavGroupView {
  key: string;
  /** null : groupe principal, sans titre. */
  label: string | null;
  items: NavItemView[];
}

/**
 * Liste de navigation groupée, partagée par la barre latérale (dense : liens de 32 px) et le
 * tiroir mobile (liens de 40 px, adaptés au toucher). Sert à l'espace personnel et à l'administration.
 */
export function AppNavList({
  groups,
  label,
  onNavigate,
  dense = false,
}: {
  groups: NavGroupView[];
  label: string;
  onNavigate?: () => void;
  dense?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="grid gap-4">
      {groups.map((group) => (
        <div key={group.key}>
          {group.label && (
            <p className="mb-1 px-3 text-xs sm:text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">
              {group.label}
            </p>
          )}
          <ul className="grid gap-0.5">
            {group.items.map(({ key, href, icon: Icon, label: itemLabel }) => {
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
                    <span className="truncate">{itemLabel}</span>
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
