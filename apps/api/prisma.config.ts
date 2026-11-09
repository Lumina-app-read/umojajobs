import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma 7 ne charge pas les fichiers .env : on lit celui du package puis celui de la racine du monorepo.
// En production, DATABASE_URL est fourni par l'environnement du conteneur.
loadEnv({ path: [resolve(__dirname, '.env'), resolve(__dirname, '../../.env')], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
  datasource: {
    // `process.env` plutôt que `env()` : `prisma generate` doit fonctionner sans base (CI, build).
    url: process.env.DATABASE_URL ?? '',
  },
});
