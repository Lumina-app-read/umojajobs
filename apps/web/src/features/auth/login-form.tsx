'use client';

import { type LoginRequest, type LoginResponse, type MfaState } from '@opportinities/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, PasswordField } from '@/components/ui/form-field';
import { Link, useRouter } from '@/i18n/navigation';
import { api, setCsrfToken } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { useFormErrors } from '@/lib/use-form-errors';
import { compact, type FieldErrors, hasErrors, validateEmail } from '@/lib/validation';

/** Page de destination après connexion, selon l'état de la double authentification. */
export function destinationAfterLogin(mfaState: MfaState): '/dashboard' | '/mfa' | '/mfa/setup' {
  if (mfaState === 'enrollment_required') return '/mfa/setup';
  if (mfaState === 'verification_required') return '/mfa';
  return '/dashboard';
}

export function LoginForm() {
  const t = useTranslations('auth');
  const tActions = useTranslations('common.actions');
  const router = useRouter();
  const { fieldMessage, fromApiError } = useFormErrors();
  const [values, setValues] = useState<LoginRequest>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<keyof LoginRequest>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notVerified, setNotVerified] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotVerified(false);
    setResendDone(false);
    const validation = compact<keyof LoginRequest>({
      email: validateEmail(values.email),
      password: values.password ? undefined : { key: 'required' },
    });
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSubmitting(true);
    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        ...values,
        email: values.email.trim(),
      });
      setCsrfToken(response.csrfToken);
      router.replace(destinationAfterLogin(response.user.mfaState));
      router.refresh();
    } catch (error) {
      setFormError(fromApiError(error).message);
      setNotVerified(error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED');
      setSubmitting(false);
    }
  }

  async function resend() {
    await api
      .post('/auth/verify-email/resend', { email: values.email.trim() })
      .catch(() => undefined);
    setResendDone(true);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <Alert tone="error">
          <p>{formError}</p>
          {notVerified && !resendDone && (
            <button
              type="button"
              onClick={resend}
              className="font-semibold underline underline-offset-2"
            >
              {t('login.resendVerification')}
            </button>
          )}
        </Alert>
      )}
      {resendDone && <Alert tone="success">{t('login.resendDone')}</Alert>}
      <FormField
        label={t('fields.email')}
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        value={values.email}
        onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
        error={fieldMessage(errors.email)}
        required
      />
      <PasswordField
        label={t('fields.password')}
        name="password"
        autoComplete="current-password"
        value={values.password}
        onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
        error={fieldMessage(errors.password)}
        showLabel={t('password.show')}
        hideLabel={t('password.hide')}
        required
      />
      <div className="text-right text-sm">
        <Link
          href="/forgot-password"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {t('login.forgot')}
        </Link>
      </div>
      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={submitting}
        loadingLabel={tActions('submitting')}
      >
        {t('login.submit')}
      </Button>
    </form>
  );
}
