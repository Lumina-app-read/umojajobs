import { defineConfig, globalIgnores } from 'eslint/config';
import { typedConfig } from '@opportinities/config/eslint/base';

export default defineConfig(
  globalIgnores(['src/generated/**', 'prisma/migrations/**']),
  typedConfig(import.meta.dirname),
  {
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: {
      // supertest expose des types `any` sur le serveur HTTP de Nest.
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    // Scripts en ligne de commande : la sortie console est leur rôle.
    files: ['prisma/seed/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
