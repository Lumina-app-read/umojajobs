'use client';

import { FINANCE_LIMITS } from '@opportinities/shared';
import { Coins, Hash, PencilLine, Save, ScrollText, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/**
 * Modification d'un paramètre financier ou d'un coût en crédits : nouvelle valeur et motif
 * obligatoire. La validation métier (bornes, décimales) est faite par l'API.
 */
export function ValueEditor({
  kind,
  target,
  name,
  current,
  placeholder,
  unit,
}: {
  kind: 'setting' | 'cost';
  /** Clé du paramètre ou code du service. */
  target: string;
  name: string;
  current: string | null;
  placeholder: string;
  unit: string;
}) {
  const t = useTranslations('common.admin.finance');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current ?? '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (kind === 'setting') {
        await api.put(`/admin/finance/settings/${target}`, { value: value.trim(), reason });
      } else {
        await api.put(`/admin/finance/service-costs/${target}`, {
          credits: Number(value),
          reason,
        });
      }
      toast.success(t('saved'));
      setOpen(false);
      setReason('');
      router.refresh();
    } catch (caught) {
      setError(fromApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" icon={PencilLine} onClick={() => setOpen(true)}>
        {t('edit')}
      </Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} title={t('editTitle', { name })}>
        <form id={`edit-${target}`} className="grid gap-4" onSubmit={submit} noValidate>
          <FormField
            label={`${kind === 'setting' ? t('valueLabel') : t('creditsLabel')} (${unit})`}
            name="value"
            inputMode="decimal"
            icon={kind === 'setting' ? Hash : Coins}
            placeholder={placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
          />
          <FormField
            label={t('reasonLabel')}
            name="reason"
            icon={ScrollText}
            placeholder={t('reasonPlaceholder')}
            hint={t('reasonHint')}
            maxLength={FINANCE_LIMITS.reasonMax}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            error={error}
            required
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              icon={X}
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              icon={Save}
              loading={busy}
              disabled={reason.trim().length < FINANCE_LIMITS.reasonMin || value.trim() === ''}
            >
              {t('save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
