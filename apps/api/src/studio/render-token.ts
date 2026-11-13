import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../config/env.validation';

/** Durée de validité d'un jeton d'impression : le temps que Chromium charge la page. */
const TOKEN_TTL_MS = 2 * 60 * 1000;

/**
 * Jetons d'accès à la page d'impression d'un export. La page web lit l'instantané de l'export
 * auprès de l'API sans session utilisateur : seul un jeton signé, propre à un export et de courte
 * durée, l'y autorise. La clé est dérivée (HKDF) de APP_ENCRYPTION_KEY, sans la réutiliser telle quelle.
 */
@Injectable()
export class RenderTokenService {
  private readonly key: Buffer;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const master = Buffer.from(config.get('APP_ENCRYPTION_KEY', { infer: true }), 'base64');
    this.key = Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), 'career-export-render', 32));
  }

  issue(exportId: string, now = Date.now()): string {
    const expires = now + TOKEN_TTL_MS;
    return `${expires}.${this.sign(exportId, expires)}`;
  }

  verify(exportId: string, token: string, now = Date.now()): boolean {
    const [expiresText, signature] = token.split('.');
    const expires = Number(expiresText);
    if (!signature || !Number.isSafeInteger(expires) || expires < now) return false;
    const expected = Buffer.from(this.sign(exportId, expires), 'base64url');
    const received = Buffer.from(signature, 'base64url');
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  private sign(exportId: string, expires: number): string {
    return createHmac('sha256', this.key).update(`${exportId}.${expires}`).digest('base64url');
  }
}
