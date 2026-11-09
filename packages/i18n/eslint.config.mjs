import { defineConfig, globalIgnores } from 'eslint/config';
import { typedConfig } from '@opportinities/config/eslint/base';

export default defineConfig(globalIgnores(['src/**/*.test.ts']), typedConfig(import.meta.dirname));
