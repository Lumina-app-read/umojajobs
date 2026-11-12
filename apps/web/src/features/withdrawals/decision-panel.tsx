'use client';

import {
  type AdminWithdrawalResponse,
  WITHDRAWAL_LIMITS,
  type WithdrawalAction,
} from '@opportinities/shared';
import {
  BadgeCheck,
  CalendarDays,
  CircleX,
  Eye,
  Hash,
  Loader,
  MessageSquareText,
  RotateCcw,
  Send,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/** Actions possibles selon l'état (les règles sont appliquées par l'API). */
const ACTIONS: Record<string, WithdrawalAction[]> = {
  pending: ['review', 'approve', 'reject'],
  under_review: ['approve', 'reject'],
  approved: ['process', 'reject'],
  processing: ['pay', 'fail', 'reject'],
};

const ICONS = {
  review: Eye,
  approve: BadgeCheck,
  process: Loader,
  pay: Send,
  fail: RotateCcw,
  reject: CircleX,
} as const;

/** Traitement d'une demande de retrait par un gestionnaire financier. */
export function WithdrawalDecisionPanel({
  withdrawal,
  currentUserId,
}: {
  withdrawal: AdminWithdrawalResponse;
  currentUserId: string;
}) {
  const t = useTranslations('jobs.withdrawals.admin');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [reference, setReference] = useState('');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<WithdrawalAction | null>(null);

  const actions = ACTIONS[withdrawal.status] ?? [];
  if (actions.length === 0) return null;
  const blockedPayout =
    withdrawal.status === 'processing' &&
    withdrawal.dualApprovalRequired &&
    withdrawal.approvedBy?.id === currentUserId;

  async function act(action: WithdrawalAction) {
    setBusy(action);
    setError(null);
    try {
      await api.post(`/admin/withdrawals/${withdrawal.id}/decision`, {
        action,
        ...(action === 'pay' ? { payoutReference: reference, paidOn } : {}),
        ...(note.trim() ? { note } : {}),
      });
      toast.success(t(`done.${action}`));
      setNote('');
      router.refresh();
    } catch (caught) {
      setError(fromApiError(caught).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid gap-4 rounded-xl border border-line bg-surface p-5 shadow-xs">
      <h2 className="text-base font-semibold text-fg">{t('decision')}</h2>
      {error && <Alert tone="error">{error}</Alert>}
      {blockedPayout && <Alert tone="warning">{t('dualNotice')}</Alert>}
      {actions.includes('pay') && !blockedPayout && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t('reference')}
            name="payoutReference"
            icon={Hash}
            placeholder={t('referencePlaceholder')}
            maxLength={WITHDRAWAL_LIMITS.referenceMax}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
          <FormField
            label={t('paidOn')}
            name="paidOn"
            type="date"
            icon={CalendarDays}
            placeholder="2026-11-12"
            value={paidOn}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </div>
      )}
      <FormField
        label={t('note')}
        name="note"
        icon={MessageSquareText}
        placeholder={t('notePlaceholder')}
        hint={t('noteHint')}
        maxLength={WITHDRAWAL_LIMITS.noteMax}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {actions
          .filter((action) => !(action === 'pay' && blockedPayout))
          .map((action) => (
            <Button
              key={action}
              variant={action === 'reject' || action === 'fail' ? 'secondary' : 'primary'}
              icon={ICONS[action]}
              loading={busy === action}
              disabled={
                busy !== null ||
                (action === 'pay' && !reference.trim()) ||
                ((action === 'reject' || action === 'fail') &&
                  note.trim().length < WITHDRAWAL_LIMITS.noteMin)
              }
              onClick={() => act(action)}
            >
              {t(`actions.${action}`)}
            </Button>
          ))}
      </div>
    </section>
  );
}
