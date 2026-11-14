'use client';

import {
  type CreditGrantResponse,
  FINANCE_LIMITS,
  type FinanceUserLookupResponse,
} from '@opportinities/shared';
import { Coins, Gift, Mail, RotateCcw, ScrollText, Search, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import { randomUuid } from '@/lib/uuid';

/**
 * Dotation de crédits gratuits : recherche du bénéficiaire par email, puis quantité et motif.
 * Une clé d'idempotence par dotation : un double clic ou une nouvelle tentative ne crédite
 * qu'une fois (contrôlé par l'API).
 */
export function CreditGrantForm() {
  const t = useTranslations('common.admin.finance');
  const { fromApiError } = useFormErrors();
  const [email, setEmail] = useState('');
  const [user, setUser] = useState<FinanceUserLookupResponse | null>(null);
  const [credits, setCredits] = useState('');
  const [reason, setReason] = useState('');
  const [key, setKey] = useState(() => randomUuid());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setUser(
        await api.get<FinanceUserLookupResponse>(
          `/admin/finance/users/lookup?email=${encodeURIComponent(email.trim())}`,
        ),
      );
    } catch (caught) {
      setError(fromApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const amount = Number(credits);
      const result = await api.post<CreditGrantResponse>(
        '/admin/finance/credit-grants',
        { userId: user.id, credits: amount, reason },
        { 'Idempotency-Key': key },
      );
      toast.success(t('grant.done', { credits: amount, balance: result.balance }));
      setUser({ ...user, balance: result.balance });
      setCredits('');
      setReason('');
      setKey(randomUuid());
    } catch (caught) {
      setError(fromApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setUser(null);
    setEmail('');
    setError(null);
    setKey(randomUuid());
  }

  return (
    <div className="grid gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      {!user ? (
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={find} noValidate>
          <FormField
            className="flex-1"
            label={t('grant.emailLabel')}
            name="email"
            type="email"
            icon={Mail}
            placeholder={t('grant.emailPlaceholder')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Button type="submit" icon={Search} loading={busy} disabled={!email.trim()}>
            {t('grant.find')}
          </Button>
        </form>
      ) : (
        <form className="grid gap-4" onSubmit={grant} noValidate>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-fg">
              <UserRound className="size-4 text-fg-subtle" aria-hidden="true" />
              <span>
                {t('grant.found', { name: user.name, balance: user.balance })}
                <span className="ml-1.5 text-fg-subtle">({user.email})</span>
              </span>
            </p>
            <Button type="button" variant="ghost" size="sm" icon={RotateCcw} onClick={reset}>
              {t('grant.change')}
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <FormField
              label={t('grant.creditsLabel')}
              name="credits"
              inputMode="numeric"
              icon={Coins}
              placeholder={t('grant.creditsPlaceholder')}
              value={credits}
              onChange={(event) => setCredits(event.target.value.replace(/\D/g, ''))}
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
              required
            />
          </div>
          <div>
            <Button
              type="submit"
              icon={Gift}
              loading={busy}
              disabled={
                !credits ||
                Number(credits) < 1 ||
                Number(credits) > FINANCE_LIMITS.grantMaxCredits ||
                reason.trim().length < FINANCE_LIMITS.reasonMin
              }
            >
              {t('grant.submit')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
