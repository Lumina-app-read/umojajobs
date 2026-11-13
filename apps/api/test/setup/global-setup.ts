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
const GARAGE_IMAGE = 'dxflrs/garage:v2.5.0';
const GARAGE_CONFIG = resolve(API_ROOT, '../../infrastructure/garage/garage.toml');
const S3_BUCKET = 'oppo-test';

/** Démarre Garage et l'initialise comme le fait `pnpm storage:init` en développement. */
async function startGarage(): Promise<{
  container: StartedTestContainer;
  accessKeyId: string;
  secretAccessKey: string;
}> {
  const container = await new GenericContainer(GARAGE_IMAGE)
    .withEnvironment({
      GARAGE_RPC_SECRET: randomBytes(32).toString('hex'),
      GARAGE_ADMIN_TOKEN: randomBytes(32).toString('base64url'),
    })
    .withCopyFilesToContainer([{ source: GARAGE_CONFIG, target: '/etc/garage.toml' }])
    .withExposedPorts(3900)
    .withWaitStrategy(Wait.forLogMessage('S3 API server listening'))
    .start();

  const garage = async (...args: string[]): Promise<string> => {
    const result = await container.exec(['/garage', ...args]);
    if (result.exitCode !== 0) throw new Error(`garage ${args.join(' ')} : ${result.output}`);
    return result.output;
  };
  const nodeId = (await garage('node', 'id', '-q')).trim().split('@')[0] as string;
  await garage('layout', 'assign', '-z', 'test', '-c', '1G', nodeId);
  await garage('layout', 'apply', '--version', '1');
  const accessKeyId = `GK${randomBytes(12).toString('hex')}`;
  const secretAccessKey = randomBytes(32).toString('hex');
  await garage('key', 'import', '--yes', '-n', 'tests', accessKeyId, secretAccessKey);
  await garage('bucket', 'create', S3_BUCKET);
  await garage('bucket', 'allow', '--read', '--write', '--owner', S3_BUCKET, '--key', accessKeyId);
  return { container, accessKeyId, secretAccessKey };
}

function runNodeScript(script: string, args: string[]): void {
  execFileSync(process.execPath, [script, ...args], {
    cwd: API_ROOT,
    env: process.env,
    stdio: 'pipe',
  });
}

/**
 * Démarre PostgreSQL, Redis, Mailpit et Garage (stockage S3) jetables, applique les migrations et le seed.
 * Toute la configuration de test est définie ici : les tests ne dépendent d'aucun fichier .env.
 * Les workers Jest héritent de ces variables, prioritaires sur un éventuel .env local.
 */
export default async function globalSetup(): Promise<void> {
  const [postgres, redis, mailpit, storage] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).start(),
    new GenericContainer(REDIS_IMAGE)
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start(),
    new GenericContainer(MAILPIT_IMAGE)
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forHttp('/livez', 8025))
      .start(),
    startGarage(),
  ]);
  globalThis.__TEST_CONTAINERS__ = [postgres, redis, mailpit, storage.container];

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
    // Faux serveur Chariow démarré par la suite des paiements (port fixe, local uniquement).
    CHARIOW_API_BASE_URL: 'http://127.0.0.1:4599/v1',
    CHARIOW_API_KEY: 'test_chariow_key',
    CHARIOW_PULSE_SECRET: 'whsec_test_secret',
    // Faux serveur OpenAI démarré par la suite du Career Studio.
    OPENAI_API_BASE_URL: 'http://127.0.0.1:4598/v1',
    OPENAI_API_KEY: 'test_openai_key',
    OPENAI_MODEL: 'test-model',
    STUDIO_AI_DAILY_LIMIT: '20',
    OPENAI_TIMEOUT_MS: '1500',
    // Le cycle de vie des offres est testé directement, sans minuterie.
    SCHEDULED_TASKS_ENABLED: 'false',
    S3_ENDPOINT: `http://${storage.container.getHost()}:${storage.container.getMappedPort(3900)}`,
    S3_REGION: 'garage',
    S3_BUCKET,
    S3_ACCESS_KEY_ID: storage.accessKeyId,
    S3_SECRET_ACCESS_KEY: storage.secretAccessKey,
    S3_FORCE_PATH_STYLE: 'true',
    JOB_FILE_MAX_MB: '1',
  });

  runNodeScript(resolve(API_ROOT, 'node_modules/prisma/build/index.js'), ['migrate', 'deploy']);
  runNodeScript(resolve(API_ROOT, 'node_modules/tsx/dist/cli.mjs'), ['prisma/seed/index.ts']);
}
