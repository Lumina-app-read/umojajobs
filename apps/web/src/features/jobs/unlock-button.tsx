'use client';

import { type UnlockResponse } from '@opportinities/shared';
import { LogIn, Unlock, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Dialog } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/**
 * Déverrouillage d'une offre : le coût et le solde sont affichés avant toute action,
 * puis une confirmation explicite est demandée. Le débit est fait par l'API, jamais ici.
 */
export function UnlockButton({
  offerId,
  cost,
  balance,
  signedIn,
}: {
  offerId: string;
  /** Coût en crédits ; null si le service n'est pas encore ouvert. */
  cost: number | null;
  balance: number;
  signedIn: boolean;
}) {
  const t = useTranslations('jobs.unlock');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!signedIn) {
    return (
      <ButtonLink href="/login" icon={LogIn} fullWidth>
        {t('loginToUnlock')}
      </ButtonLink>
    );
  }
  if (cost === null) {
    return (
      <>
        <Button icon={Unlock} disabled fullWidth>
          {t('button')}
        </Button>
        <p className="text-center text-xs text-fg-subtle">{t('notConfigured')}</p>
      </>
    );
  }

  const missing = Math.max(0, cost - balance);

  async function confirm() {
    setBusy(true);
    try {
      const result = await api.post<UnlockResponse>('/me/unlocks', { jobOfferId: offerId });
      if (result.charged) toast.success(t('unlockedToast'), t('unlockedToastBody'));
      else toast.success(t('alreadyToast'));
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(fromApiError(error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button icon={Unlock} fullWidth disabled={missing > 0} onClick={() => setOpen(true)}>
        {t('buttonWithCost', { credits: cost })}
      </Button>
      <p className="text-center text-xs text-fg-subtle">
        {missing > 0 ? t('insufficient', { missing }) : t('balance', { balance })}
      </p>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={t('confirmTitle')}
        description={t('confirmBody', { credits: cost, after: balance - cost })}
        size="sm"
        footer={
          <>
            <Button variant="secondary" icon={X} onClick={() => setOpen(false)} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button icon={Unlock} loading={busy} onClick={confirm}>
              {t('confirm')}
            </Button>
          </>
        }
      >
        {t('confirmNote')}
      </Dialog>
    </>
  );
}
