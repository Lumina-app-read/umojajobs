import 'server-only';
import { type MeResponse } from '@opportinities/shared';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getCurrentUser } from './api/server';

type MfaPage = '/mfa' | '/mfa/setup';

/**
 * Exige une session complète (double authentification validée si nécessaire) pour une page
 * protégée. La protection réelle reste celle de l'API : cette redirection améliore le parcours.
 */
export async function requireUser(): Promise<MeResponse> {
  const locale = await getLocale();
  const result = await getCurrentUser();
  if (!result.data) {
    return redirect({ href: '/login', locale });
  }
  if (result.data.mfaState === 'enrollment_required') {
    return redirect({ href: '/mfa/setup', locale });
  }
  if (result.data.mfaState === 'verification_required') {
    return redirect({ href: '/mfa', locale });
  }
  return result.data;
}

/** Pages de double authentification : accessibles seulement lorsque l'étape correspondante est attendue. */
export async function requireMfaStep(page: MfaPage): Promise<MeResponse> {
  const locale = await getLocale();
  const result = await getCurrentUser();
  if (!result.data) {
    return redirect({ href: '/login', locale });
  }
  const expected: MfaPage | null =
    result.data.mfaState === 'enrollment_required'
      ? '/mfa/setup'
      : result.data.mfaState === 'verification_required'
        ? '/mfa'
        : null;
  if (expected === null) {
    return redirect({ href: '/dashboard', locale });
  }
  if (expected !== page) {
    return redirect({ href: expected, locale });
  }
  return result.data;
}
