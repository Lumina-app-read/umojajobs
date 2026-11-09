import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type CookieOptions, type Response } from 'express';
import { type EnvironmentVariables } from '../config/env.validation';

/**
 * Noms et options des cookies. En mode sécurisé (production), le préfixe `__Host-` impose
 * `Secure`, `Path=/` et l'absence de `Domain` : le cookie ne peut pas être posé par un sous-domaine.
 */
@Injectable()
export class CookiesService {
  readonly secure: boolean;
  readonly sessionCookieName: string;
  readonly csrfCookieName: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.secure = config.get('COOKIE_SECURE', { infer: true });
    const prefix = this.secure ? '__Host-' : '';
    this.sessionCookieName = `${prefix}oppo_session`;
    this.csrfCookieName = `${prefix}oppo_csrf`;
  }

  private baseOptions(): CookieOptions {
    return { secure: this.secure, sameSite: 'lax', path: '/' };
  }

  /** Cookie de session : inaccessible au JavaScript (HttpOnly). */
  setSessionCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(this.sessionCookieName, token, {
      ...this.baseOptions(),
      httpOnly: true,
      expires: expiresAt,
    });
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie(this.sessionCookieName, { ...this.baseOptions(), httpOnly: true });
  }

  /** Cookie CSRF : lisible par le JavaScript de l'application, qui le recopie dans X-CSRF-Token. */
  setCsrfCookie(res: Response, token: string): void {
    res.cookie(this.csrfCookieName, token, { ...this.baseOptions(), httpOnly: false });
  }
}
