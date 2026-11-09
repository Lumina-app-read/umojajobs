import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import { type PermissionCode } from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { type AppRequest } from '../common/http/app-request';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ALLOW_PENDING_MFA_KEY = 'auth:allowPendingMfa';
export const SKIP_CSRF_KEY = 'security:skipCsrf';
export const REQUIRED_PERMISSIONS_KEY = 'auth:requiredPermissions';

/** Route accessible sans session. Par défaut, toutes les routes exigent une session valide. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Route accessible avant validation du TOTP pour un administrateur (inscription ou vérification
 * du TOTP, déconnexion, profil minimal).
 */
export const AllowPendingMfa = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_PENDING_MFA_KEY, true);

/**
 * Désactive le contrôle CSRF. Réservé aux appels serveur à serveur authentifiés autrement
 * (webhooks signés, phase 3). Ne jamais l'utiliser sur une route appelée par le navigateur.
 */
export const SkipCsrf = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_CSRF_KEY, true);

/** Exige toutes les permissions indiquées (vérification côté serveur). */
export const RequirePermissions = (
  ...permissions: PermissionCode[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/** Injecte le contexte d'authentification de la requête (route protégée uniquement). */
export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const auth = ctx.switchToHttp().getRequest<AppRequest>().auth;
  if (!auth) {
    throw new Error('CurrentAuth utilisé sur une route sans session.');
  }
  return auth satisfies AuthContext;
});
