'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Lock,
  LogIn,
  Mail,
  MailCheck,
  RefreshCw,
  User,
  UserPlus,
  UserRound,
} from 'lucide-react';
import {
  type AcceptedResponse,
  type CountryResponse,
  PASSWORD_MIN_LENGTH,
  type RegisterRequest,
} from '@opportinities/shared';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { CountrySelect } from '@/components/forms/country-select';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Checkbox, FormField, PasswordField } from '@/components/ui/form-field';
import { Stepper } from '@/components/ui/navigation';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { useFormErrors } from '@/lib/use-form-errors';
import {
  type FieldErrors,
  hasErrors,
  passwordContainsIdentity,
  REGISTER_STEPS,
  type RegisterValues,
  validateRegisterStep,
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

type Step = 0 | 1;

const linkClasses = 'font-medium text-brand underline-offset-2 hover:underline';

/** Règle de mot de passe cochée en direct. */
function Rule({ met, children }: { met: boolean; children: string }) {
  const Icon = met ? Check : Circle;
  return (
    <li className={cn('flex items-center gap-2', met ? 'text-success' : 'text-fg-muted')}>
      <Icon className={cn('shrink-0', met ? 'size-3.5' : 'size-2.5 mx-0.5')} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

/**
 * Inscription en deux étapes : « Vos informations » (prénom, nom, pays), puis « Votre compte »
 * (email, mot de passe, conditions). Les saisies sont conservées en revenant en arrière, et une
 * erreur de l'API portant sur l'étape 1 y ramène automatiquement.
 */
export function RegisterForm({ countries }: { countries: CountryResponse[] }) {
  const t = useTranslations('auth');
  const tActions = useTranslations('common.actions');
  const locale = useLocale();
  const { fieldMessage, fromApiError } = useFormErrors();
  const [step, setStep] = useState<Step>(0);
  const [direction, setDirection] = useState<'forward' | 'back' | null>(null);
  const [values, setValues] = useState<RegisterValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<keyof RegisterValues>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [resendDone, setResendDone] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);

  // L'écran de confirmation remplace le formulaire : le focus va à son titre pour l'annoncer.
  useEffect(() => {
    if (submittedEmail) successRef.current?.focus();
  }, [submittedEmail]);

  // Après un changement d'étape (pas au premier affichage), le focus va au premier champ.
  useEffect(() => {
    if (direction === null) return;
    stepRef.current?.querySelector<HTMLInputElement>('input:not([type="hidden"])')?.focus();
  }, [step, direction]);

  const set = <K extends keyof RegisterValues>(key: K, value: RegisterValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    // L'erreur d'un champ disparaît dès qu'il est modifié.
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  };

  const goTo = (target: Step) => {
    setDirection(target > step ? 'forward' : 'back');
    setStep(target);
  };

  function next() {
    const validation = validateRegisterStep(values, 0);
    setErrors(validation);
    if (!hasErrors(validation)) {
      setFormError(null);
      goTo(1);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 0) {
      next();
      return;
    }
    setFormError(null);
    const validation = validateRegisterStep(values, 1);
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
      const firstStepFields: readonly string[] = REGISTER_STEPS[0];
      if (Object.keys(fields).some((field) => firstStepFields.includes(field))) goTo(0);
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (!submittedEmail) return;
    await api.post('/auth/verify-email/resend', { email: submittedEmail }).catch(() => undefined);
    setResendDone(true);
  }

  if (submittedEmail) {
    return (
      <div className="animate-fade-up">
        <span className="grid size-12 place-items-center rounded-xl bg-primary-soft text-brand">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <h2
          ref={successRef}
          tabIndex={-1}
          className="mt-5 text-xl font-bold tracking-[-0.02em] text-fg outline-none"
        >
          {t('register.successTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          {t.rich('register.successBody', {
            email: submittedEmail,
            b: (chunks) => <strong className="font-semibold text-fg">{chunks}</strong>,
          })}
        </p>
        <p className="mt-2 text-sm text-fg-muted">{t('register.successHint')}</p>
        {resendDone && (
          <Alert tone="success" className="mt-5">
            {t('register.resendDone')}
          </Alert>
        )}
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <ButtonLink href="/login" size="lg" fullWidth icon={LogIn}>
            {t('register.goToLogin')}
          </ButtonLink>
          <Button
            variant="secondary"
            size="lg"
            icon={RefreshCw}
            onClick={resend}
            disabled={resendDone}
          >
            {t('register.resend')}
          </Button>
        </div>
      </div>
    );
  }

  const stepLabels = [t('register.stepYou'), t('register.stepAccount')];
  const lengthMet = values.password.length >= PASSWORD_MIN_LENGTH;
  const identityMet =
    values.password.length > 0 && !passwordContainsIdentity(values.password, values);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <Stepper current={step + 1} total={2} label={stepLabels[step] ?? ''} />
      {formError && <Alert tone="error">{formError}</Alert>}

      <div
        key={step}
        ref={stepRef}
        className={cn(
          'grid gap-5',
          direction === 'forward' && 'animate-step-forward',
          direction === 'back' && 'animate-step-back',
        )}
      >
        {step === 0 ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                label={t('fields.firstName')}
                name="firstName"
                icon={User}
                placeholder={t('placeholders.firstName')}
                autoComplete="given-name"
                value={values.firstName}
                onChange={(event) => set('firstName', event.target.value)}
                error={fieldMessage(errors.firstName)}
                required
              />
              <FormField
                label={t('fields.lastName')}
                name="lastName"
                icon={UserRound}
                placeholder={t('placeholders.lastName')}
                autoComplete="family-name"
                value={values.lastName}
                onChange={(event) => set('lastName', event.target.value)}
                error={fieldMessage(errors.lastName)}
                required
              />
            </div>
            <CountrySelect
              countries={countries}
              label={t('fields.country')}
              value={values.countryIso2}
              onChange={(iso2) => set('countryIso2', iso2)}
              error={fieldMessage(errors.countryIso2)}
            />
            <Button type="submit" fullWidth size="lg" trailingIcon={ArrowRight}>
              {tActions('continue')}
            </Button>
          </>
        ) : (
          <>
            <FormField
              label={t('fields.email')}
              name="email"
              icon={Mail}
              placeholder={t('placeholders.email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={values.email}
              onChange={(event) => set('email', event.target.value)}
              error={fieldMessage(errors.email)}
              required
            />
            <div className="grid gap-2.5">
              <PasswordField
                icon={Lock}
                label={t('fields.password')}
                placeholder={t('placeholders.newPassword')}
                name="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(event) => set('password', event.target.value)}
                error={fieldMessage(errors.password)}
                showLabel={t('password.show')}
                hideLabel={t('password.hide')}
                aria-describedby="password-rules"
                required
              />
              <div id="password-rules" className="text-sm sm:text-[13px]">
                <p className="sr-only">{t('register.rulesTitle')}</p>
                <ul className="grid gap-1">
                  <Rule met={lengthMet}>
                    {t('register.ruleLength', { min: PASSWORD_MIN_LENGTH })}
                  </Rule>
                  <Rule met={identityMet}>{t('register.ruleIdentity')}</Rule>
                </ul>
              </div>
            </div>
            <PasswordField
              icon={Lock}
              label={t('fields.passwordConfirmation')}
              placeholder={t('placeholders.passwordConfirmation')}
              name="passwordConfirmation"
              autoComplete="new-password"
              value={values.passwordConfirmation}
              onChange={(event) => set('passwordConfirmation', event.target.value)}
              error={fieldMessage(errors.passwordConfirmation)}
              valid={
                values.passwordConfirmation.length > 0 &&
                values.passwordConfirmation === values.password
              }
              showLabel={t('password.show')}
              hideLabel={t('password.hide')}
              required
            />
            <Checkbox
              name="acceptTerms"
              checked={values.acceptTerms}
              onChange={(event) => set('acceptTerms', event.target.checked)}
              error={fieldMessage(errors.acceptTerms)}
              label={t.rich('register.acceptTerms', {
                terms: (chunks) => (
                  <Link href="/terms" target="_blank" className={linkClasses}>
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/privacy" target="_blank" className={linkClasses}>
                    {chunks}
                  </Link>
                ),
              })}
            />
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button
                variant="secondary"
                size="lg"
                icon={ArrowLeft}
                onClick={() => goTo(0)}
                disabled={submitting}
              >
                {tActions('back')}
              </Button>
              <Button
                type="submit"
                size="lg"
                icon={UserPlus}
                loading={submitting}
                loadingLabel={tActions('submitting')}
              >
                {t('register.submit')}
              </Button>
            </div>
          </>
        )}
      </div>
    </form>
  );
}
