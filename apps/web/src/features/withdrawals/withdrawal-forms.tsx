'use client';

import {
  type CountryResponse,
  WITHDRAWAL_LIMITS,
  WITHDRAWAL_METHOD_TYPES,
  type WithdrawalMethodResponse,
  type WithdrawalMethodType,
} from '@opportinities/shared';
import {
  ArrowDownToLine,
  Banknote,
  Building2,
  CreditCard,
  DollarSign,
  Plus,
  Smartphone,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { CountrySelect } from '@/components/forms/country-select';
import { FormSelect } from '@/components/ui/form-controls';
import { FormField } from '@/components/ui/form-field';
import { toast } from '@/components/ui/toast';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';

/** Ajout d'un moyen de retrait (Mobile Money ou virement) : coordonnées chiffrées par l'API. */
export function AddMethodButton({
  countries,
  defaultCountry,
}: {
  countries: CountryResponse[];
  defaultCountry: string;
}) {
  const t = useTranslations('jobs.withdrawals');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<WithdrawalMethodType | null>('mobile_money');
  const [country, setCountry] = useState(defaultCountry);
  const [provider, setProvider] = useState('');
  const [holder, setHolder] = useState('');
  const [account, setAccount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mobile = type === 'mobile_money';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/me/withdrawal-methods', {
        type,
        countryIso2: country,
        provider,
        accountHolder: holder,
        accountNumber: account,
      });
      toast.success(t('methodAdded'));
      setOpen(false);
      setProvider('');
      setAccount('');
      router.refresh();
    } catch (caught) {
      setError(fromApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" icon={Plus} onClick={() => setOpen(true)}>
        {t('addMethod')}
      </Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} title={t('addMethod')}>
        <form className="grid gap-4" onSubmit={submit} noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <FormSelect
            label={t('methodType')}
            icon={WalletCards}
            placeholder={t('methodType')}
            value={type}
            onChange={setType}
            options={WITHDRAWAL_METHOD_TYPES.map((value) => ({
              value,
              label: t(`types.${value}`),
            }))}
          />
          <CountrySelect
            countries={countries}
            value={country}
            onChange={setCountry}
            label={t('country')}
          />
          <FormField
            label={mobile ? t('operator') : t('bank')}
            name="provider"
            icon={mobile ? Smartphone : Building2}
            placeholder={mobile ? t('operatorPlaceholder') : t('bankPlaceholder')}
            maxLength={WITHDRAWAL_LIMITS.providerMax}
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            required
          />
          <FormField
            label={t('holder')}
            name="accountHolder"
            icon={UserRound}
            placeholder={t('holderPlaceholder')}
            maxLength={WITHDRAWAL_LIMITS.holderMax}
            value={holder}
            onChange={(event) => setHolder(event.target.value)}
            required
          />
          <FormField
            label={mobile ? t('phone') : t('accountNumber')}
            name="accountNumber"
            icon={mobile ? Smartphone : CreditCard}
            inputMode={mobile ? 'tel' : 'text'}
            placeholder={mobile ? t('phonePlaceholder') : t('accountPlaceholder')}
            hint={t('encryptedHint')}
            maxLength={WITHDRAWAL_LIMITS.accountMax}
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            required
          />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" icon={X} onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              icon={Plus}
              loading={busy}
              disabled={!type || !provider.trim() || !holder.trim() || !account.trim()}
            >
              {t('saveMethod')}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Demande de retrait : montant entre le seuil et le solde disponible (contrôlés par l'API). */
export function RequestWithdrawalForm({
  methods,
  availableUsd,
  minimumUsd,
}: {
  methods: WithdrawalMethodResponse[];
  availableUsd: string;
  minimumUsd: string | null;
}) {
  const t = useTranslations('jobs.withdrawals');
  const router = useRouter();
  const { fromApiError } = useFormErrors();
  const [methodId, setMethodId] = useState<string | null>(methods[0]?.id ?? null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post('/me/withdrawals', {
        methodId,
        amountUsd: amount.replace(',', '.').trim(),
      });
      toast.success(t('requested'), t('requestedBody'));
      setAmount('');
      router.refresh();
    } catch (caught) {
      setError(fromApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <FormSelect
          label={t('method')}
          icon={Banknote}
          placeholder={t('chooseMethod')}
          value={methodId}
          onChange={setMethodId}
          options={methods.map((method) => ({
            value: method.id,
            label: `${method.provider} · ${method.maskedAccount}`,
          }))}
        />
        <FormField
          label={t('amount')}
          name="amountUsd"
          inputMode="decimal"
          icon={DollarSign}
          placeholder={t('amountPlaceholder', { amount: availableUsd })}
          hint={minimumUsd ? t('amountHint', { minimum: minimumUsd }) : undefined}
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ''))}
          required
        />
      </div>
      <div>
        <Button type="submit" icon={ArrowDownToLine} loading={busy} disabled={!methodId || !amount}>
          {t('request')}
        </Button>
      </div>
    </form>
  );
}
