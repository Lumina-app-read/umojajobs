import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '@opportinities/shared';
import { type Response } from 'express';
import { type AppRequest } from '../../common/http/app-request';
import { CookiesService } from '../../security/cookies.service';
import { ALLOW_PENDING_MFA_KEY, IS_PUBLIC_KEY } from '../../security/decorators';
import { SessionsService } from '../sessions.service';

/**
 * Authentification par défaut de toutes les routes (sauf @Public) : session valide obligatoire.
 * Un administrateur dont le TOTP n'est pas encore validé n'accède qu'aux routes @AllowPendingMfa.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly cookies: CookiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest<AppRequest>();
    const token = req.cookies[this.cookies.sessionCookieName];
    if (!token) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHENTICATED });
    }

    const auth = await this.sessions.resolve(token);
    if (!auth) {
      this.cookies.clearSessionCookie(http.getResponse<Response>());
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHENTICATED });
    }
    req.auth = auth;

    const pending =
      auth.mfaState === 'enrollment_required' || auth.mfaState === 'verification_required';
    if (pending && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_MFA_KEY, targets)) {
      throw new ForbiddenException({
        code:
          auth.mfaState === 'enrollment_required'
            ? ERROR_CODES.MFA_ENROLLMENT_REQUIRED
            : ERROR_CODES.MFA_REQUIRED,
        meta: { mfaState: auth.mfaState },
      });
    }
    return true;
  }
}
