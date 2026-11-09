'use client';

import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { type MfaVerifyRequest } from '@opportinities/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import { type FieldError, validateRecoveryCode, validateTotpCode } from '@/lib/validation';

export function MfaVerifyForm() {
  const t = useTranslations('auth');
  const tActions = useTranslations('common.actions');
  const router = useRouter();
  const { fieldMessage, fromApiError } = useFormErrors();
  const [mode, setMode] = useState<'code' | 'recovery'>('code');
  const [value, setValue] = useState('');
  const [error, setError] = useState<FieldError | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const validation = mode === 'code' ? validateTotpCode(value) : validateRecoveryCode(value);
    setError(validation);
    if (validation) return;
    setSubmitting(true);
    try {
      const payload: MfaVerifyRequest =
        mode === 'code' ? { code: value.trim() } : { recoveryCode: value.trim() };
      await api.post('/auth/mfa/verify', payload);
      router.replace('/dashboard');
      router.refresh();
    } catch (apiError) {
      setFormError(fromApiError(apiError).message);
      setValue('');
      setSubmitting(false);
    }
  }

  const switchMode = () => {
    setMode((current) => (current === 'code' ? 'recovery' : 'code'));
    setValue('');
    setError(undefined);
    setFormError(null);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      {mode === 'code' ? (
        <FormField
          key="code"
          label={t('fields.code')}
          icon={Smartphone}
          placeholder={t('placeholders.code')}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/\D/g, ''))}
          error={fieldMessage(error)}
          autoFocus
          className="[&_input]:font-mono [&_input]:tracking-[0.4em]"
        />
      ) : (
        <FormField
          key="recovery"
          label={t('fields.recoveryCode')}
          icon={KeyRound}
          placeholder={t('placeholders.recoveryCode')}
          name="recoveryCode"
          autoComplete="off"
          maxLength={11}
          value={value}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          error={fieldMessage(error)}
          autoFocus
          className="[&_input]:font-mono"
        />
      )}
      <Button
        type="submit"
        fullWidth
        icon={ShieldCheck}
        size="lg"
        loading={submitting}
        loadingLabel={tActions('submitting')}
      >
        {t('mfa.submit')}
      </Button>
      <button
        type="button"
        onClick={switchMode}
        className="inline-flex w-full items-center justify-center gap-2 text-sm font-medium text-brand underline-offset-2 hover:underline"
      >
        {mode === 'code' ? (
          <KeyRound className="size-4" aria-hidden="true" />
        ) : (
          <Smartphone className="size-4" aria-hidden="true" />
        )}
        {mode === 'code' ? t('mfa.useRecovery') : t('mfa.useCode')}
      </button>
    </form>
  );
}
