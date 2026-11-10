import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

declare global {
  var __TEST_CONTAINERS__: (StartedPostgreSqlContainer | StartedTestContainer)[] | undefined;
}

const API_ROOT = resolve(__dirname, '../..');

/** Mêmes versions que le Docker Compose de développement. */
const POSTGRES_IMAGE = 'postgres:17.11-alpine';
const REDIS_IMAGE = 'redis:7.4.12-alpine';
const MAILPIT_IMAGE = 'axllent/mailpit:v1.33.1';

function runNodeScript(script: string, args: string[]): void {
  execFileSync(process.execPath, [script, ...args], {
    cwd: API_ROOT,
    env: process.env,
    stdio: 'pipe',
  });
}

/**
 * Démarre PostgreSQL, Redis et Mailpit jetables, applique les migrations et le seed.
 * Toute la configuration de test est définie ici : les tests ne dépendent d'aucun fichier .env.
 * Les workers Jest héritent de ces variables, prioritaires sur un éventuel .env local.
 */
export default async function globalSetup(): Promise<void> {
  const [postgres, redis, mailpit] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).start(),
    new GenericContainer(REDIS_IMAGE)
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start(),
    new GenericContainer(MAILPIT_IMAGE)
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forHttp('/livez', 8025))
      .start(),
  ]);
  globalThis.__TEST_CONTAINERS__ = [postgres, redis, mailpit];

  Object.assign(process.env, {
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:3000',
    DATABASE_URL: postgres.getConnectionUri(),
    REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}/0`,
    SMTP_HOST: mailpit.getHost(),
    SMTP_PORT: String(mailpit.getMappedPort(1025)),
    SMTP_SECURE: 'false',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    MAIL_FROM: 'OPPORTINITIES <no-reply@opportinities.test>',
    MAILPIT_API_URL: `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}`,
    APP_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    TERMS_VERSION: '2026-11-09',
    COOKIE_SECURE: 'false',
    TRUST_PROXY: '0',
    AUTH_MAX_FAILED_LOGINS: '5',
    AUTH_LOCKOUT_MINUTES: '15',
    // Le cycle de vie des offres est testé directement, sans minuterie.
    SCHEDULED_TASKS_ENABLED: 'false',
  });

  runNodeScript(resolve(API_ROOT, 'node_modules/prisma/build/index.js'), ['migrate', 'deploy']);
  runNodeScript(resolve(API_ROOT, 'node_modules/tsx/dist/cli.mjs'), ['prisma/seed/index.ts']);
}
