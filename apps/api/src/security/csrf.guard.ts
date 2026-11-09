import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@opportinities/shared';
import { safeEqual } from '../common/crypto/tokens';
import { type AppRequest } from '../common/http/app-request';
import { type EnvironmentVariables } from '../config/env.validation';
import { CookiesService } from './cookies.service';
import { SKIP_CSRF_KEY } from './decorators';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-csrf-token';

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Protection CSRF de toutes les requêtes qui modifient des données :
 * 1. l'origine (Origin, à défaut Referer) doit être celle de l'application ;
 * 2. l'en-tête X-CSRF-Token doit être identique au cookie CSRF (« double submit »).
 * Un site tiers ne peut ni lire le cookie, ni ajouter cet en-tête sans autorisation CORS.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly reflector: Reflector,
    private readonly cookies: CookiesService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.allowedOrigins = new Set([new URL(config.get('APP_URL', { infer: true })).origin]);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (SAFE_METHODS.has(req.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const origin = originOf(req.get('origin')) ?? originOf(req.get('referer'));
    const cookieToken = req.cookies[this.cookies.csrfCookieName];
    const headerToken = req.get(CSRF_HEADER);

    const valid =
      origin !== null &&
      this.allowedOrigins.has(origin) &&
      typeof cookieToken === 'string' &&
      cookieToken.length >= 32 &&
      typeof headerToken === 'string' &&
      safeEqual(cookieToken, headerToken);

    if (!valid) {
      throw new ForbiddenException({ code: ERROR_CODES.CSRF_INVALID });
    }
    return true;
  }
}
