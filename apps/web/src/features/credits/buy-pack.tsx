'use client';

import {
  type CreditCheckoutResponse,
  type CreditOrderResponse,
  type CreditPackResponse,
} from '@opportinities/shared';
import { CircleCheck, CreditCard, Loader, Phone, ShieldCheck, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/**
 * Achat d'un pack : confirmation, téléphone exigé par Chariow, puis redirection vers la page de
 * paiement Chariow. Les crédits ne sont attribués qu'après confirmation par le serveur.
 */
export function BuyPackButton({
  pack,
  defaultPhone,
  priceLabel,
}: {
  pack: CreditPackResponse;
  defaultPhone: string | null;
  priceLabel: string;
}) {
  const t = useTranslations('jobs.credits');
  const { fromApiError } = useFormErrors();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<CreditCheckoutResponse>('/me/credit-orders', {
        packId: pack.id,
        phone: phone.trim() || undefined,
      });
      window.location.assign(result.checkoutUrl);
    } catch (caught) {
      setError(fromApiError(caught).message);
      setBusy(false);
    }
  }

  return (
    <>
      <Button icon={CreditCard} fullWidth onClick={() => setOpen(true)}>
        {t('buy')}
      </Button>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={t('buyTitle', { credits: pack.credits })}
        description={t('buyBody', { price: priceLabel })}
        size="sm"
      >
        <form className="grid gap-4" onSubmit={pay} noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <FormField
            label={t('phone')}
            name="phone"
            type="tel"
            icon={Phone}
            placeholder={t('phonePlaceholder')}
            hint={t('phoneHint')}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <p className="flex items-start gap-2 text-xs text-fg-subtle">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            {t('secure')}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" icon={X} onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" icon={CreditCard} loading={busy}>
              {t('pay', { price: priceLabel })}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/**
 * Retour de la page de paiement : le navigateur ne prouve rien. L'état de la commande est
 * interrogé (le serveur relit alors la vente chez Chariow) jusqu'à confirmation, 3 minutes au plus.
 */
export function OrderStatus({ reference }: { reference: string }) {
  const t = useTranslations('jobs.credits');
  const router = useRouter();
  const [status, setStatus] = useState<CreditOrderResponse['status'] | 'unknown'>('pending');

  useEffect(() => {
    let attempts = 0;
    let stopped = false;
    const tick = async () => {
      attempts += 1;
      try {
        const order = await api.get<CreditOrderResponse>(`/me/credit-orders/${reference}`);
        if (stopped) return;
        setStatus(order.status);
        if (order.status === 'paid') {
          router.refresh();
          return;
        }
        if (order.status !== 'pending') return;
      } catch {
        if (!stopped) setStatus('unknown');
        return;
      }
      if (attempts < 60) setTimeout(() => void tick(), 3000);
    };
    void tick();
    return () => {
      stopped = true;
    };
  }, [reference, router]);

  if (status === 'paid') {
    return (
      <Alert tone="success" title={t('paidTitle')}>
        <span className="flex items-center gap-2">
          <CircleCheck className="size-4" aria-hidden="true" />
          {t('paidBody')}
        </span>
      </Alert>
    );
  }
  if (status === 'pending') {
    return (
      <Alert tone="info" title={t('verifyingTitle')}>
        <span className="flex items-center gap-2">
          <Loader className="size-4 animate-spin" aria-hidden="true" />
          {t('verifyingBody')}
        </span>
      </Alert>
    );
  }
  return <Alert tone="warning">{t(`orderStatus.${status}`)}</Alert>;
}
