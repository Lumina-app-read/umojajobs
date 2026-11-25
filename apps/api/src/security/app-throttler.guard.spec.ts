import { type ExecutionContext } from '@nestjs/common';
import { type ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { type ThrottlerStorage } from '@nestjs/throttler';
import { type EnvironmentVariables } from '../config/env.validation';
import { AppThrottlerGuard, INTERNAL_TOKEN_HEADER } from './app-throttler.guard';

const TOKEN = 'jeton-interne-de-test-0123456789abcdef';

function guard(token: string | undefined) {
  const config = { get: () => token } as unknown as ConfigService<EnvironmentVariables, true>;
  return new AppThrottlerGuard(
    { throttlers: [{ ttl: 60_000, limit: 120 }] },
    {} as ThrottlerStorage,
    new Reflector(),
    config,
  );
}

function context(method: string, header?: string): ExecutionContext {
  const req = {
    method,
    get: (name: string) => (name === INTERNAL_TOKEN_HEADER ? header : undefined),
  };
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

const skips = (instance: AppThrottlerGuard, ctx: ExecutionContext): Promise<boolean> =>
  (instance as unknown as { shouldSkip(c: ExecutionContext): Promise<boolean> }).shouldSkip(ctx);

describe('AppThrottlerGuard', () => {
  it('exempte les lectures du serveur web qui présentent le bon jeton', async () => {
    await expect(skips(guard(TOKEN), context('GET', TOKEN))).resolves.toBe(true);
    await expect(skips(guard(TOKEN), context('HEAD', TOKEN))).resolves.toBe(true);
  });

  it('limite toujours les écritures, même avec le jeton', async () => {
    await expect(skips(guard(TOKEN), context('POST', TOKEN))).resolves.toBe(false);
  });

  it('limite les requêtes sans jeton ou avec un jeton erroné', async () => {
    await expect(skips(guard(TOKEN), context('GET'))).resolves.toBe(false);
    await expect(skips(guard(TOKEN), context('GET', `${TOKEN}x`))).resolves.toBe(false);
    await expect(skips(guard(TOKEN), context('GET', 'court'))).resolves.toBe(false);
  });

  it("n'exempte rien quand aucun jeton n'est configuré", async () => {
    await expect(skips(guard(undefined), context('GET', TOKEN))).resolves.toBe(false);
    await expect(skips(guard(undefined), context('GET', ''))).resolves.toBe(false);
  });
});
