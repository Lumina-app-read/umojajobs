import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ERROR_CODES } from '@opportinities/shared';
import type Redis from 'ioredis';
import { sha256Hex } from '../common/crypto/tokens';
import { type EnvironmentVariables } from '../config/env.validation';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Verrouillage temporaire des adresses email inconnues après plusieurs échecs, avec les mêmes
 * seuils que les comptes réels (verrouillés en base). Ainsi, le comportement de la connexion ne
 * révèle pas si une adresse possède un compte.
 */
@Injectable()
export class LoginThrottleService {
  private readonly logger = new Logger(LoginThrottleService.name);
  readonly maxFailures: number;
  readonly lockoutMs: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxFailures = config.get('AUTH_MAX_FAILED_LOGINS', { infer: true });
    this.lockoutMs = config.get('AUTH_LOCKOUT_MINUTES', { infer: true }) * 60 * 1000;
  }

  lockedException(retryAfterMs: number): HttpException {
    return new HttpException(
      {
        code: ERROR_CODES.ACCOUNT_LOCKED,
        meta: { retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private key(email: string): string {
    return `login-failures:${sha256Hex(email)}`;
  }

  /** Temps de verrouillage restant (ms) pour une adresse inconnue, 0 si aucun. */
  async unknownEmailLockRemaining(email: string): Promise<number> {
    try {
      const [count, ttl] = await Promise.all([
        this.redis.get(this.key(email)),
        this.redis.pttl(this.key(email)),
      ]);
      return Number(count ?? 0) >= this.maxFailures && ttl > 0 ? ttl : 0;
    } catch (error) {
      this.logger.warn(`Compteur d'échecs indisponible : ${String(error)}`);
      return 0;
    }
  }

  async recordUnknownEmailFailure(email: string): Promise<void> {
    try {
      const key = this.key(email);
      const count = await this.redis.incr(key);
      if (count === 1 || count === this.maxFailures) {
        await this.redis.pexpire(key, this.lockoutMs);
      }
    } catch (error) {
      this.logger.warn(`Compteur d'échecs indisponible : ${String(error)}`);
    }
  }
}
