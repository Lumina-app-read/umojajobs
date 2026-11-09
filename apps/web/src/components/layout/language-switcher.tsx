'use client';

import { SUPPORTED_LOCALES } from '@opportinities/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/** Bascule FR / EN en conservant la page courante. La langue choisie est mémorisée (cookie next-intl). */
export function LanguageSwitcher() {
  const t = useTranslations('common.language');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="flex rounded-md border border-border bg-surface p-0.5"
    >
      {SUPPORTED_LOCALES.map((target) => (
        <button
          key={target}
          type="button"
          lang={target}
          aria-pressed={locale === target}
          aria-label={t(target)}
          disabled={pending}
          onClick={() => startTransition(() => router.replace(pathname, { locale: target }))}
          className={cn(
            'h-8 rounded px-2 text-xs font-semibold uppercase',
            locale === target
              ? 'bg-surface-muted text-primary'
              : 'text-muted hover:text-foreground',
          )}
        >
          {target}
        </button>
      ))}
    </div>
  );
}
