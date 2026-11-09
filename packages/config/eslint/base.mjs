// Configuration ESLint de base pour les projets TypeScript du monorepo (hors Next.js,
// qui utilise eslint-config-next et ajoute ces règles par-dessus).
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * Configuration avec vérification des types (typescript-eslint, projectService).
 * @param {string} tsconfigRootDir Dossier racine du projet qui utilise la configuration.
 */
export function typedConfig(tsconfigRootDir) {
  return defineConfig(
    // Seuls les fichiers TypeScript sont analysés avec les types ; les fichiers de configuration JS sont exclus.
    globalIgnores(['dist/**', 'coverage/**', '.turbo/**', '**/*.js', '**/*.mjs', '**/*.cjs']),
    js.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        eqeqeq: ['error', 'always'],
        'no-console': 'error',
      },
    },
  );
}
