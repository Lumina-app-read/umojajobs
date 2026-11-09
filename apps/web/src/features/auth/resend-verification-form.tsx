'use client';

import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import { type FieldError, validateEmail } from '@/lib/validation';

/** Demande d'un nouveau lien de confirmation (réponse identique que le compte existe ou non). */
export function ResendVerificationForm() {
  const t = useTranslations('auth');
  const { fieldMessage, fromApiError } = useFormErrors();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<FieldError | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateEmail(email);
    setError(validation);
    if (validation) return;
    setSubmitting(true);
    try {
      await api.post('/auth/verify-email/resend', { email: email.trim() });
      setDone(true);
    } catch (apiError) {
      setFormError(fromApiError(apiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <Alert tone="success">{t('verifyEmail.resendDone')}</Alert>;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <h2 className="text-base font-semibold text-fg">{t('verifyEmail.resendTitle')}</h2>
      {formError && <Alert tone="error">{formError}</Alert>}
      <FormField
        label={t('fields.email')}
        name="email"
        icon={Mail}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldMessage(error)}
      />
      <Button type="submit" variant="secondary" fullWidth loading={submitting}>
        {t('verifyEmail.resendSubmit')}
      </Button>
    </form>
  );
}
