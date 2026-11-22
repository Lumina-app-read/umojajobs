'use client';

import {
  type AdminUserDetail,
  STAFF_ROLES,
  type StaffRole,
  USER_ADMIN_LIMITS,
} from '@opportinities/shared';
import { Ban, KeyRound, RotateCcw, ScrollText, UserMinus, UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextAreaField } from '@/components/ui/form-controls';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

type Action =
  { kind: 'suspend' | 'reactivate' } | { kind: 'role'; role: StaffRole; granted: boolean };

/**
 * Actions de l'administration sur un compte. Chacune demande un motif et une confirmation ; l'API
 * revérifie les droits et journalise l'opération.
 */
export function UserActions({ user }: { user: AdminUserDetail }) {
  const t = useTranslations('common.admin.users');
  const tValidation = useTranslations('common.admin.finance');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { suspend, reactivate, manageRoles } = user.can;

  function open(next: Action) {
    setAction(next);
    setReason('');
    setReasonError(null);
    setError(null);
  }

  async function confirm() {
    if (!action) return;
    const trimmed = reason.trim();
    if (trimmed.length < USER_ADMIN_LIMITS.reasonMin) {
      setReasonError(tValidation('reasonHint'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (action.kind === 'role') {
        await api.post(`/admin/users/${user.id}/roles`, {
          role: action.role,
          granted: action.granted,
          reason: trimmed,
        });
      } else {
        await api.post(`/admin/users/${user.id}/${action.kind}`, { reason: trimmed });
      }
      toast.success(t(`done.${doneKey(action)}`));
      setAction(null);
      router.refresh();
    } catch (caught) {
      setError(fromApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  if (!suspend && !reactivate && !manageRoles) {
    return (
      <section className="rounded-xl border border-line bg-surface p-5 text-sm text-fg-muted shadow-xs">
        {t('noAction')}
      </section>
    );
  }

  const key = action ? doneKey(action) : null;
  const role = action?.kind === 'role' ? t(`roles.${action.role}`) : '';
  return (
    <>
      {(suspend || reactivate) && (
        <section className="grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs">
          <div>
            <h2 className="text-base font-semibold text-fg">{t('access')}</h2>
            <p className="mt-1 text-sm text-fg-muted sm:text-[13px]">
              {t(suspend ? 'suspendHint' : 'reactivateHint')}
            </p>
          </div>
          {suspend ? (
            <Button variant="danger" icon={Ban} onClick={() => open({ kind: 'suspend' })}>
              {t('suspend')}
            </Button>
          ) : (
            <Button icon={RotateCcw} onClick={() => open({ kind: 'reactivate' })}>
              {t('reactivate')}
            </Button>
          )}
        </section>
      )}

      {manageRoles && (
        <section className="grid gap-3 rounded-xl border border-line bg-surface p-5 shadow-xs">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
              <KeyRound className="size-4 text-fg-subtle" aria-hidden="true" />
              {t('rolesTitle')}
            </h2>
            <p className="mt-1 text-sm text-fg-muted sm:text-[13px]">{t('rolesHint')}</p>
          </div>
          <ul className="grid divide-y divide-line rounded-lg border border-line">
            {STAFF_ROLES.map((code) => {
              const held = user.roles.includes(code);
              return (
                <li key={code} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{t(`roles.${code}`)}</p>
                    <p className="text-xs text-fg-subtle">{t(`roleHints.${code}`)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={held ? UserMinus : UserPlus}
                    aria-label={`${t(held ? 'revoke' : 'grant')} : ${t(`roles.${code}`)}`}
                    onClick={() => open({ kind: 'role', role: code, granted: !held })}
                  >
                    {t(held ? 'revoke' : 'grant')}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Dialog
        open={action !== null}
        onClose={() => !busy && setAction(null)}
        title={key ? t(`confirm.${key}.title`, { name: user.name, role }) : ''}
        description={key ? t(`confirm.${key}.body`) : undefined}
        footer={
          <>
            <Button variant="secondary" icon={X} disabled={busy} onClick={() => setAction(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant={key === 'suspend' || key === 'revoke' ? 'danger' : 'primary'}
              icon={key ? CONFIRM_ICON[key] : Ban}
              loading={busy}
              onClick={() => void confirm()}
            >
              {key ? t(key) : ''}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <TextAreaField
            label={t('reason')}
            name="reason"
            icon={ScrollText}
            placeholder={t('reasonPlaceholder')}
            rows={3}
            maxLength={USER_ADMIN_LIMITS.reasonMax}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(null);
            }}
            error={reasonError}
          />
          {error && <Alert tone="error">{error}</Alert>}
        </div>
      </Dialog>
    </>
  );
}

const CONFIRM_ICON = {
  suspend: Ban,
  reactivate: RotateCcw,
  grant: UserPlus,
  revoke: UserMinus,
} as const;

const doneKey = (action: Action): keyof typeof CONFIRM_ICON =>
  action.kind === 'role' ? (action.granted ? 'grant' : 'revoke') : action.kind;
