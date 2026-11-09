'use client';

import { type RecoveryCodesResponse, type TotpSetupResponse } from '@opportinities/shared';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { toDataURL } from 'qrcode';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import { type FieldError, validateTotpCode } from '@/lib/validation';

type Step =
  | { name: 'intro' }
  | { name: 'scan'; secret: string; qrDataUrl: string }
  | { name: 'recovery'; codes: string[] };

/**
 * Inscription du TOTP en trois étapes : démarrage explicite (un seul secret généré), scan du
 * QR code et confirmation par un premier code, puis affichage unique des codes de secours.
 */
export function MfaSetup() {
  const t = useTranslations('auth');
  const tActions = useTranslations('common.actions');
  const router = useRouter();
  const { fieldMessage, fromApiError } = useFormErrors();
  const [step, setStep] = useState<Step>({ name: 'intro' });
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<FieldError | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function start() {
    setBusy(true);
    setFormError(null);
    try {
      const setup = await api.post<TotpSetupResponse>('/auth/mfa/totp/setup');
      const qrDataUrl = await toDataURL(setup.otpauthUri, { margin: 1, width: 224 });
      setStep({ name: 'scan', secret: setup.secret, qrDataUrl });
    } catch (error) {
      setFormError(fromApiError(error).message);
    } finally {
      setBusy(false);
    }
  }

  async function enable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const validation = validateTotpCode(code);
    setCodeError(validation);
    if (validation) return;
    setBusy(true);
    try {
      const result = await api.post<RecoveryCodesResponse>('/auth/mfa/totp/enable', {
        code: code.trim(),
      });
      setStep({ name: 'recovery', codes: result.recoveryCodes });
    } catch (error) {
      setFormError(fromApiError(error).message);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (step.name === 'intro') {
    return (
      <div className="space-y-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        <p className="text-sm text-fg-muted">{t('mfa.setupIntro')}</p>
        <Button
          fullWidth
          size="lg"
          onClick={start}
          loading={busy}
          loadingLabel={tActions('loading')}
        >
          {tActions('continue')}
        </Button>
      </div>
    );
  }

  if (step.name === 'scan') {
    return (
      <form onSubmit={enable} noValidate className="space-y-5">
        {formError && <Alert tone="error">{formError}</Alert>}
        <p className="text-sm text-fg">{t('mfa.step1')}</p>
        <div className="flex justify-center">
          {/* QR code généré localement : le secret n'est transmis à aucun service tiers. */}
          <Image
            src={step.qrDataUrl}
            alt={t('mfa.qrAlt')}
            width={224}
            height={224}
            unoptimized
            className="rounded-md border border-line bg-white p-2"
          />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-fg-muted">{t('mfa.manualKey')}</p>
          <code className="block break-all rounded-md bg-surface-2 px-3 py-2 font-mono text-sm text-fg">
            {step.secret.replace(/(.{4})/g, '$1 ').trim()}
          </code>
        </div>
        <p className="text-sm text-fg">{t('mfa.step2')}</p>
        <FormField
          label={t('fields.code')}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          error={fieldMessage(codeError)}
          className="[&_input]:font-mono [&_input]:tracking-[0.4em]"
        />
        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={busy}
          loadingLabel={tActions('submitting')}
        >
          {t('mfa.enable')}
        </Button>
      </form>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(step.codes.join('\n'));
    setCopied(true);
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-fg">{t('mfa.recoveryTitle')}</h2>
      <Alert tone="info">{t('mfa.recoveryIntro')}</Alert>
      <ul className="grid grid-cols-2 gap-2 rounded-md bg-surface-2 p-4 font-mono text-sm text-fg">
        {step.codes.map((recoveryCode) => (
          <li key={recoveryCode}>{recoveryCode}</li>
        ))}
      </ul>
      <Button variant="secondary" fullWidth onClick={copy}>
        {copied ? t('mfa.copied') : t('mfa.copy')}
      </Button>
      <label className="flex items-start gap-3 text-sm text-fg">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>{t('mfa.recoveryConfirm')}</span>
      </label>
      <Button
        fullWidth
        size="lg"
        disabled={!confirmed}
        onClick={() => {
          router.replace('/dashboard');
          router.refresh();
        }}
      >
        {tActions('continue')}
      </Button>
    </div>
  );
}
