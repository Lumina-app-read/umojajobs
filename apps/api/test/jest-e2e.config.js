/**
 * Tests de bout en bout et d'intégration : une vraie base PostgreSQL est démarrée par
 * Testcontainers (Docker requis), migrée et alimentée par le seed avant les tests.
 * @type {import('jest').Config}
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  globalSetup: '<rootDir>/setup/global-setup.ts',
  globalTeardown: '<rootDir>/setup/global-teardown.ts',
  testTimeout: 30_000,
};
