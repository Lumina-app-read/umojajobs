'use client';

import { Lock, Mail, User } from 'lucide-react';
import {
  type AcceptedResponse,
  type CountryResponse,
  PASSWORD_MIN_LENGTH,
  type RegisterRequest,
} from '@opportinities/shared';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { CountrySelect } from '@/components/forms/country-select';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, PasswordField } from '@/components/ui/form-field';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import {
  type FieldErrors,
  hasErrors,
  type RegisterValues,
  validateRegister,
} from '@/lib/validation';

const EMPTY: RegisterValues = {
  firstName: '',
  lastName: '',
  email: '',
  countryIso2: '',
  password: '',
  passwordConfirmation: '',
  acceptTerms: false,
};

export function RegisterForm({ countries }: { countries: CountryResponse[] }) {
  const t = useTranslations('auth');
  const tActions = useTranslations('common.actions');
  const locale = useLocale();
  const { fieldMessage, fromApiError } = useFormErrors();
  const [values, setValues] = useState<RegisterValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<keyof RegisterValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const set = <K extends keyof RegisterValues>(key: K, value: RegisterValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const validation = validateRegister(values);
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSubmitting(true);
    try {
      const payload: RegisterRequest = {
        ...values,
        email: values.email.trim(),
        locale: locale === 'en' ? 'en' : 'fr',
      };
      await api.post<AcceptedResponse>('/auth/register', payload);
      setSubmittedEmail(payload.email);
    } catch (error) {
      const { message, fields } = fromApiError(error);
      setFormError(message);
      setErrors(fields);
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedEmail) {
    return (
      <Alert tone="success">
        <p className="font-semibold">{t('register.successTitle')}</p>
        <p>{t('register.successBody', { email: submittedEmail })}</p>
        <p>{t('register.successHint')}</p>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label={t('fields.firstName')}
          name="firstName"
          icon={User}
          autoComplete="given-name"
          value={values.firstName}
          onChange={(event) => set('firstName', event.target.value)}
          error={fieldMessage(errors.firstName)}
          required
        />
        <FormField
          label={t('fields.lastName')}
          name="lastName"
          autoComplete="family-name"
          value={values.lastName}
          onChange={(event) => set('lastName', event.target.value)}
          error={fieldMessage(errors.lastName)}
          required
        />
      </div>
      <FormField
        label={t('fields.email')}
        name="email"
        icon={Mail}
        type="email"
        autoComplete="email"
        inputMode="email"
        value={values.email}
        onChange={(event) => set('email', event.target.value)}
        error={fieldMessage(errors.email)}
        required
      />
      <CountrySelect
        countries={countries}
        label={t('fields.country')}
        value={values.countryIso2}
        onChange={(iso2) => set('countryIso2', iso2)}
        error={fieldMessage(errors.countryIso2)}
      />
      <PasswordField
        icon={Lock}
        label={t('fields.password')}
        name="password"
        autoComplete="new-password"
        value={values.password}
        onChange={(event) => set('password', event.target.value)}
        error={fieldMessage(errors.password)}
        hint={t('password.hint', { min: PASSWORD_MIN_LENGTH })}
        showLabel={t('password.show')}
        hideLabel={t('password.hide')}
        required
      />
      <PasswordField
        icon={Lock}
        label={t('fields.passwordConfirmation')}
        name="passwordConfirmation"
        autoComplete="new-password"
        value={values.passwordConfirmation}
        onChange={(event) => set('passwordConfirmation', event.target.value)}
        error={fieldMessage(errors.passwordConfirmation)}
        showLabel={t('password.show')}
        hideLabel={t('password.hide')}
        required
      />
      <div className="space-y-1.5">
        <label className="flex items-start gap-3 text-sm text-fg">
          <input
            type="checkbox"
            name="acceptTerms"
            checked={values.acceptTerms}
            onChange={(event) => set('acceptTerms', event.target.checked)}
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={errors.acceptTerms ? 'accept-terms-error' : undefined}
            className="mt-0.5 size-4 rounded border-line-strong accent-primary"
          />
          <span>
            {t.rich('register.acceptTerms', {
              terms: (chunks) => (
                <Link
                  href="/terms"
                  target="_blank"
                  className="font-medium text-brand underline-offset-2 hover:underline"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  href="/privacy"
                  target="_blank"
                  className="font-medium text-brand underline-offset-2 hover:underline"
                >
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {errors.acceptTerms && (
          <p id="accept-terms-error" className="text-sm font-medium text-danger">
            {fieldMessage(errors.acceptTerms)}
          </p>
        )}
      </div>
      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={submitting}
        loadingLabel={tActions('submitting')}
      >
        {t('register.submit')}
      </Button>
    </form>
  );
}
