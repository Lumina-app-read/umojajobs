import { createHash, timingSafeEqual } from 'node:crypto';
import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { type Request } from 'express';
import { type EnvironmentVariables } from '../config/env.validation';

/** En-tête porté par les lectures publiques du serveur de l'application web. */
export const INTERNAL_TOKEN_HEADER = 'x-internal-token';

const SAFE_METHODS = new Set(['GET', 'HEAD']);
const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * Limitation par adresse IP, sauf pour les lectures (GET, HEAD) du serveur de l'application web
 * qui présentent le jeton interne : ces lectures publiques sont mises en cache et viennent toutes
 * de la même adresse interne, elles épuiseraient la limite commune. Les écritures restent
 * toujours limitées.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly internalToken: Buffer | null;

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    super(options, storage, reflector);
    const token = config.get('INTERNAL_API_TOKEN', { infer: true });
    this.internalToken = token ? digest(token) : null;
  }

  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (this.isInternalRead(context.switchToHttp().getRequest<Request>())) return true;
    return super.shouldSkip(context);
  }

  private isInternalRead(req: Request): boolean {
    if (!this.internalToken || !SAFE_METHODS.has(req.method)) return false;
    const presented = req.get(INTERNAL_TOKEN_HEADER);
    return Boolean(presented) && timingSafeEqual(digest(presented!), this.internalToken);
  }
}
