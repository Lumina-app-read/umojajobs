'use client';

import { Mail, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import { type FieldError, validateEmail } from '@/lib/validation';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const tActions = useTranslations('common.actions');
  const { fieldMessage, fromApiError } = useFormErrors();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<FieldError | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const validation = validateEmail(email);
    setError(validation);
    if (validation) return;
    setSubmitting(true);
    try {
      await api.post('/auth/password/forgot', { email: email.trim() });
      setSentTo(email.trim());
    } catch (apiError) {
      setFormError(fromApiError(apiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) return <Alert tone="success">{t('forgotPassword.done', { email: sentTo })}</Alert>;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <FormField
        label={t('fields.email')}
        name="email"
        icon={Mail}
        placeholder={t('placeholders.email')}
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldMessage(error)}
        required
      />
      <Button
        type="submit"
        fullWidth
        icon={Send}
        size="lg"
        loading={submitting}
        loadingLabel={tActions('submitting')}
      >
        {t('forgotPassword.submit')}
      </Button>
    </form>
  );
}
