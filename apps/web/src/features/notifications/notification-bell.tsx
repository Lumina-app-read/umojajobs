'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api/client';

const REFRESH_MS = 60_000;

/** Événement émis quand le nombre de non lues change (centre de notifications). */
export const UNREAD_EVENT = 'umoja:notifications-unread';

export function announceUnread(unread: number): void {
  window.dispatchEvent(new CustomEvent<number>(UNREAD_EVENT, { detail: unread }));
}

/** Cloche de l'en-tête : nombre de notifications non lues, relu à chaque page et chaque minute. */
export function NotificationBell({ className }: { className: string }) {
  const t = useTranslations('notifications');
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get<{ unread: number }>('/me/notifications/unread-count')
        .then((result) => active && setUnread(result.unread))
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    const onChange = (event: Event) => setUnread((event as CustomEvent<number>).detail);
    window.addEventListener(UNREAD_EVENT, onChange);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener(UNREAD_EVENT, onChange);
    };
  }, [pathname]);

  return (
    <Link
      href="/dashboard/notifications"
      className={`relative ${className}`}
      aria-label={t('bell', { count: unread })}
    >
      <Bell className="size-[18px]" aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger-solid px-1 text-[10px] leading-none font-bold text-white tabular-nums"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
