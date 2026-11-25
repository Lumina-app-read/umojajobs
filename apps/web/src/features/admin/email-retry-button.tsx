'use client';

import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';

/**
 * Remet en file un email en échec (id) ou tous les échecs (sans id). L'API ne touche qu'aux
 * emails encore en échec et journalise l'action dans l'audit.
 */
export function EmailRetryButton({ id, count }: { id?: string; count?: number }) {
  const t = useTranslations('common.admin.emails');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      const { requeued } = await api.post<{ requeued: number }>(
        id ? `/admin/notifications/emails/${id}/retry` : '/admin/notifications/emails/retry',
      );
      toast.success(t('retryDone', { count: requeued }));
      router.refresh();
    } catch {
      toast.error(t('retryError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={id ? 'ghost' : 'secondary'}
      size={id ? 'sm' : 'md'}
      icon={RotateCcw}
      loading={busy}
      onClick={() => void retry()}
    >
      {id ? t('retry') : t('retryAll', { count: count ?? 0 })}
    </Button>
  );
}
