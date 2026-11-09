import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

declare global {
  var __POSTGRES_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

const API_ROOT = resolve(__dirname, '../..');

/** Même version que le Docker Compose de développement et que la production. */
const POSTGRES_IMAGE = 'postgres:17.11-alpine';

function runNodeScript(script: string, args: string[], databaseUrl: string): void {
  execFileSync(process.execPath, [script, ...args], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

/**
 * Démarre une base PostgreSQL jetable, applique les migrations et le seed.
 * Les workers Jest héritent de DATABASE_URL, qui prime sur le fichier .env.
 */
export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const databaseUrl = container.getConnectionUri();

  runNodeScript(
    resolve(API_ROOT, 'node_modules/prisma/build/index.js'),
    ['migrate', 'deploy'],
    databaseUrl,
  );
  runNodeScript(
    resolve(API_ROOT, 'node_modules/tsx/dist/cli.mjs'),
    ['prisma/seed/index.ts'],
    databaseUrl,
  );

  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = 'test';
  globalThis.__POSTGRES_CONTAINER__ = container;
}
