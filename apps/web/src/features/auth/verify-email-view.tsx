'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api/client';
import { useFormErrors } from '@/lib/use-form-errors';
import { ResendVerificationForm } from './resend-verification-form';
import { clearHashToken, useHashToken } from './use-hash-token';

type State = { status: 'pending' } | { status: 'success' } | { status: 'error'; message: string };

export function VerifyEmailView() {
  const t = useTranslations('auth.verifyEmail');
  const { fromApiError } = useFormErrors();
  const token = useHashToken();
  const [state, setState] = useState<State>({ status: 'pending' });
  const submitted = useRef(false);

  useEffect(() => {
    // Un seul envoi, même si l'effet est rejoué (mode strict de React en développement).
    if (!token || submitted.current) return;
    submitted.current = true;
    api
      .post('/auth/verify-email', { token })
      .then(() => setState({ status: 'success' }))
      .catch((error: unknown) =>
        setState({ status: 'error', message: fromApiError(error).message }),
      )
      .finally(clearHashToken);
  }, [token, fromApiError]);

  if (state.status === 'success') {
    return (
      <div className="space-y-6">
        <Alert tone="success">{t('success')}</Alert>
        <Link href="/login" className={buttonClasses('primary', 'lg', true)}>
          {t('loginCta')}
        </Link>
      </div>
    );
  }

  if (state.status === 'error' || token === null) {
    return (
      <div className="space-y-6">
        <Alert tone="error">{state.status === 'error' ? state.message : t('missingToken')}</Alert>
        <ResendVerificationForm />
      </div>
    );
  }

  return (
    <p role="status" className="text-sm text-fg-muted">
      {t('verifying')}
    </p>
  );
}
