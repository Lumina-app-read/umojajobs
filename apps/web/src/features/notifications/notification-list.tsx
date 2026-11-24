'use client';

import { type NotificationResponse, type NotificationsPage } from '@opportinities/shared';
import { Bell, CheckCheck, ChevronDown } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { toast } from '@/components/ui/toast';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/use-form-errors';
import { announceUnread } from './notification-bell';
import { NOTIFICATION_ICONS } from './notification-icons';

/** Texte d'une notification : mêmes clés que les emails, montants mis en forme dans la langue. */
export function useNotificationText() {
  const t = useTranslations('notifications');
  const format = useFormatter();
  return (item: NotificationResponse) => {
    const params = {
      offer: item.data.offer ?? '',
      reason: item.data.reason ?? '',
      credits: item.data.credits ?? 0,
      amount: format.number(Number(item.data.amountUsd ?? 0), {
        style: 'currency',
        currency: 'USD',
      }),
      status: item.data.status ? t(`withdrawalStatus.${item.data.status as 'paid'}`) : '',
    };
    return {
      title: t(`types.${item.type}.title`, params),
      body: t(`types.${item.type}.body`, params).trim(),
    };
  };
}

/** Centre de notifications : lecture, ouverture et pagination. */
export function NotificationList({
  initial,
  compact = false,
}: {
  initial: NotificationsPage;
  compact?: boolean;
}) {
  const t = useTranslations('notifications');
  const format = useFormatter();
  const router = useRouter();
  const text = useNotificationText();
  const { fromApiError } = useFormErrors();
  const [page, setPage] = useState(initial);
  const [busy, setBusy] = useState<'all' | 'more' | null>(null);

  async function markRead(ids?: string[]) {
    const { unread } = await api.post<{ unread: number }>(
      '/me/notifications/read',
      ids ? { ids } : {},
    );
    setPage((current) => ({
      ...current,
      unread,
      items: current.items.map((item) =>
        !ids || ids.includes(item.id) ? { ...item, read: true } : item,
      ),
    }));
    // La cloche de l'en-tête se met à jour aussitôt ; les pages serveur, à la prochaine visite.
    announceUnread(unread);
    router.refresh();
  }

  async function markAll() {
    setBusy('all');
    try {
      await markRead();
    } catch (caught) {
      toast.error(fromApiError(caught).message);
    } finally {
      setBusy(null);
    }
  }

  async function more() {
    if (!page.next) return;
    setBusy('more');
    try {
      const next = await api.get<NotificationsPage>(`/me/notifications?before=${page.next}`);
      setPage((current) => ({ ...next, items: [...current.items, ...next.items] }));
    } catch (caught) {
      toast.error(fromApiError(caught).message);
    } finally {
      setBusy(null);
    }
  }

  if (page.items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title={t('empty')}
        description={t('emptyBody')}
        className="bg-surface py-12"
      />
    );
  }

  return (
    <div className="grid gap-3">
      {!compact && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            icon={CheckCheck}
            loading={busy === 'all'}
            disabled={page.unread === 0}
            onClick={() => void markAll()}
          >
            {page.unread === 0 ? t('allRead') : t('markAll')}
          </Button>
        </div>
      )}
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-xs">
        {page.items.map((item) => {
          const Icon = NOTIFICATION_ICONS[item.type];
          const { title, body } = text(item);
          const content = (
            <>
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-lg',
                  item.read ? 'bg-surface-2 text-fg-subtle' : 'bg-primary-soft text-brand',
                )}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn('text-sm text-fg', !item.read && 'font-semibold')}>
                    {title}
                  </span>
                  {!item.read && (
                    <span
                      className="size-2 shrink-0 rounded-full bg-primary"
                      aria-label={t('unread')}
                    />
                  )}
                </span>
                <span className="mt-0.5 block text-sm break-words text-fg-muted sm:text-[13px]">
                  {body}
                </span>
                <span className="mt-1 block text-xs text-fg-subtle">
                  {format.dateTime(new Date(item.createdAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </span>
            </>
          );
          const className =
            'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2';
          return (
            <li key={item.id}>
              {item.link ? (
                <Link
                  href={item.link}
                  className={className}
                  onClick={() => {
                    if (!item.read) void markRead([item.id]).catch(() => undefined);
                  }}
                >
                  {content}
                </Link>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {!compact && page.next && (
        <Button
          variant="secondary"
          icon={ChevronDown}
          loading={busy === 'more'}
          onClick={() => void more()}
          className="justify-self-center"
        >
          {t('more')}
        </Button>
      )}
    </div>
  );
}
