'use client';

import { type SessionResponse } from '@opportinities/shared';
import { LogOut, Monitor, Smartphone, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api, setCsrfToken } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import { describeDevice } from './device';

/** Sessions actives : appareil, adresse IP, dernière activité, déconnexion à distance. */
export function SessionsList({ sessions }: { sessions: SessionResponse[] }) {
  const t = useTranslations('common.app.settings');
  const format = useFormatter();
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function revoke(id: string) {
    setPendingId(id);
    try {
      await api.delete(`/auth/sessions/${id}`);
      toast.success(t('revoked'));
      router.refresh();
    } catch (error) {
      toast.error(fromApiError(error).message);
    } finally {
      setPendingId(null);
    }
  }

  async function logoutAll() {
    setLoggingOut(true);
    await api.post('/auth/logout-all').catch(() => undefined);
    setCsrfToken(null);
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {sessions.map((session) => {
          const device = describeDevice(session.userAgent);
          const Icon = device.mobile ? Smartphone : Monitor;
          return (
            <li key={session.id} className="flex items-center gap-4 px-4 py-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-muted">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-fg">
                  {device.label ?? t('unknownDevice')}
                  {session.current && <Badge tone="success">{t('currentSession')}</Badge>}
                </p>
                <p className="mt-0.5 truncate text-sm sm:text-[13px] text-fg-muted">
                  {[
                    session.ip,
                    t('lastActive', {
                      date: format.dateTime(new Date(session.lastSeenAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {!session.current && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={X}
                  loading={pendingId === session.id}
                  onClick={() => revoke(session.id)}
                >
                  {t('revoke')}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {sessions.length <= 1 && (
        <p className="text-sm sm:text-[13px] text-fg-muted">{t('sessionsEmpty')}</p>
      )}
      <div>
        <Button variant="danger" icon={LogOut} onClick={() => setConfirmOpen(true)}>
          {t('logoutAll')}
        </Button>
      </div>
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('logoutAllTitle')}
        description={t('logoutAllBody')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" icon={X} onClick={() => setConfirmOpen(false)}>
              {t('cancel')}
            </Button>
            <Button variant="danger" icon={LogOut} loading={loggingOut} onClick={logoutAll}>
              {t('logoutAll')}
            </Button>
          </>
        }
      />
    </div>
  );
}
