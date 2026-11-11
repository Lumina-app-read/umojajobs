import 'server-only';
import { type MeResponse } from '@opportinities/shared';
import { getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
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

/**
 * Espace d'administration : exige une session complète et la permission demandée.
 * Sans elle, la page répond « introuvable » pour ne pas révéler son existence.
 * L'API applique ses propres contrôles : cette vérification ne fait qu'éviter un écran inutile.
 */
export async function requirePermission(permission: string): Promise<MeResponse> {
  const user = await requireUser();
  if (!user.permissions.includes(permission)) notFound();
  return user;
}

/** La session courante dispose-t-elle de cette permission ? (Sans redirection : pour les métadonnées.) */
export async function hasPermission(permission: string): Promise<boolean> {
  const result = await getCurrentUser().catch(() => null);
  return Boolean(
    result?.data &&
    !result.data.mfaState.endsWith('_required') &&
    result.data.permissions.includes(permission),
  );
}

/**
 * Pages publiques des offres : un utilisateur connecté (même s'il lui reste l'étape de double
 * authentification) est renvoyé vers la page équivalente de son espace personnel, qui gère la suite.
 */
export async function redirectSignedIn(href: string): Promise<void> {
  const result = await getCurrentUser().catch(() => null);
  if (result?.data) {
    redirect({ href, locale: await getLocale() });
  }
}
