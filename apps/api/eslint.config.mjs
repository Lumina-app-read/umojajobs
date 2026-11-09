import { defineConfig } from 'eslint/config';
import { typedConfig } from '@opportinities/config/eslint/base';

export default defineConfig(typedConfig(import.meta.dirname), {
  files: ['**/*.spec.ts', 'test/**/*.ts'],
  rules: {
    // supertest expose des types `any` sur le serveur HTTP de Nest.
    '@typescript-eslint/no-unsafe-argument': 'off',
  },
});
