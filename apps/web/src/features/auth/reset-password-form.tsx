'use client';

import { PASSWORD_MIN_LENGTH, type ResetPasswordRequest } from '@opportinities/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { PasswordField } from '@/components/ui/form-field';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { useFormErrors } from '@/lib/use-form-errors';
import {
  compact,
  type FieldErrors,
  hasErrors,
  validateConfirmation,
  validateNewPassword,
} from '@/lib/validation';
import { clearHashToken, useHashToken } from './use-hash-token';

type Fields = 'password' | 'passwordConfirmation';

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const tActions = useTranslations('common.actions');
  const { fieldMessage, fromApiError } = useFormErrors();
  const token = useHashToken();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (done) {
    return (
      <div className="space-y-6">
        <Alert tone="success">{t('resetPassword.success')}</Alert>
        <Link href="/login" className={buttonClasses('primary', 'lg', true)}>
          {t('login.submit')}
        </Link>
      </div>
    );
  }

  if (token === undefined) return null;

  if (token === null || tokenInvalid) {
    return (
      <div className="space-y-6">
        <Alert tone="error">
          {tokenInvalid && formError ? formError : t('resetPassword.missingToken')}
        </Alert>
        <Link href="/forgot-password" className={buttonClasses('secondary', 'md', true)}>
          {t('resetPassword.requestNew')}
        </Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const validation = compact<Fields>({
      password: validateNewPassword(password),
      passwordConfirmation: validateConfirmation(password, confirmation),
    });
    setErrors(validation);
    if (hasErrors(validation) || !token) return;
    setSubmitting(true);
    try {
      const payload: ResetPasswordRequest = { token, password, passwordConfirmation: confirmation };
      await api.post('/auth/password/reset', payload);
      clearHashToken();
      setDone(true);
    } catch (error) {
      setFormError(fromApiError(error).message);
      if (error instanceof ApiError && error.code === 'TOKEN_INVALID') {
        clearHashToken();
        setTokenInvalid(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <PasswordField
        label={t('fields.newPassword')}
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldMessage(errors.password)}
        hint={t('password.hint', { min: PASSWORD_MIN_LENGTH })}
        showLabel={t('password.show')}
        hideLabel={t('password.hide')}
        required
      />
      <PasswordField
        label={t('fields.newPasswordConfirmation')}
        name="passwordConfirmation"
        autoComplete="new-password"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        error={fieldMessage(errors.passwordConfirmation)}
        showLabel={t('password.show')}
        hideLabel={t('password.hide')}
        required
      />
      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={submitting}
        loadingLabel={tActions('submitting')}
      >
        {t('resetPassword.submit')}
      </Button>
    </form>
  );
}
