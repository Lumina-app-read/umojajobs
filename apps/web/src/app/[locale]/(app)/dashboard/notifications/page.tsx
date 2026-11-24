import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Alert } from '@/components/ui/alert';
import { NotificationList } from '@/features/notifications/notification-list';
import { getNotifications } from '@/lib/api/server';
import { requireUser } from '@/lib/auth-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notifications');
  return { title: t('title') };
}

/** Centre de notifications de l'utilisateur connecté. */
export default async function NotificationsPage() {
  await requireUser();
  const [t, tErrors, page] = await Promise.all([
    getTranslations('notifications'),
    getTranslations('errors'),
    getNotifications(),
  ]);
  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-fg sm:text-[28px]">
          {t('title')}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">{t('intro')}</p>
      </div>
      {page === null ? (
        <Alert tone="error">{tErrors('SERVICE_UNAVAILABLE')}</Alert>
      ) : (
        <NotificationList initial={page} />
      )}
    </div>
  );
}
