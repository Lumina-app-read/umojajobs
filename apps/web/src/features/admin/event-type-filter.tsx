'use client';

import { SECURITY_EVENT_TYPES, type SecurityEventTypeCode } from '@opportinities/shared';
import { ChevronDown, Filter } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { buttonClasses } from '@/components/ui/button';
import { SelectMenu } from '@/components/ui/select-menu';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

type FilterValue = SecurityEventTypeCode | 'all';

/** Filtre du journal par type d'événement : met à jour l'adresse (?type=…), revient à la première page. */
export function EventTypeFilter({ value }: { value: FilterValue }) {
  const t = useTranslations('common.admin');
  const router = useRouter();

  return (
    <SelectMenu<FilterValue>
      value={value}
      label={t('security.filterType')}
      anchor="bottom start"
      onChange={(type) =>
        router.push(
          type === 'all'
            ? '/admin/security-events'
            : { pathname: '/admin/security-events', query: { type } },
        )
      }
      options={[
        { value: 'all', label: t('security.allTypes') },
        ...SECURITY_EVENT_TYPES.map((type) => ({ value: type, label: t(`events.${type}`) })),
      ]}
      triggerClassName={cn(buttonClasses('secondary', 'md'), 'justify-between gap-2')}
      trigger={
        <>
          <Filter className="size-4 text-fg-subtle" aria-hidden="true" />
          <span className="max-w-56 truncate">
            {value === 'all' ? t('security.allTypes') : t(`events.${value}`)}
          </span>
          <ChevronDown className="size-4 text-fg-subtle" aria-hidden="true" />
        </>
      }
    />
  );
}
