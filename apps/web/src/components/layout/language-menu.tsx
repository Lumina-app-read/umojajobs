'use client';

import { type Locale, SUPPORTED_LOCALES } from '@opportinities/shared';
import { ChevronDown, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { SelectMenu } from '@/components/ui/select-menu';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

/**
 * Sélecteur de langue unique : « FR » ou « EN » avec un globe, menu « Français / English ».
 * Chaque langue est écrite dans sa propre langue. Pas de drapeau : le français et l'anglais
 * sont parlés dans des dizaines de pays africains. La préférence est mémorisée par next-intl.
 */
/** Langue courante et changement de langue en restant sur la même page. */
export function useLocaleSwitch() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const switchLocale = (target: Locale) =>
    startTransition(() => router.replace(pathname, { locale: target }));
  return { locale, switchLocale, pending };
}

export function LanguageMenu({ className }: { className?: string }) {
  const t = useTranslations('common.language');
  const { locale, switchLocale, pending } = useLocaleSwitch();

  return (
    <SelectMenu<Locale>
      value={locale}
      onChange={switchLocale}
      label={t('label')}
      disabled={pending}
      options={SUPPORTED_LOCALES.map((value) => ({ value, label: t(value), lang: value }))}
      triggerClassName={cn(buttonClasses('ghost', 'md'), 'gap-1.5 px-2 sm:px-2.5', className)}
      trigger={
        <>
          <Globe className="size-4" aria-hidden="true" />
          <span className="text-xs font-bold tracking-wide uppercase">{locale}</span>
          <ChevronDown className="size-3.5 text-fg-subtle max-sm:hidden" aria-hidden="true" />
        </>
      }
    />
  );
}
