import { NodeEnv, validateEnv } from './env.validation';

const BASE = {
  APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://user:secret-value@localhost:5432/db',
  REDIS_URL: 'redis://:secret-value@localhost:6379/0',
  APP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'OPPORTINITIES <no-reply@example.test>',
  TERMS_VERSION: '2026-11-09',
};

describe('validateEnv', () => {
  it('applique les valeurs par défaut', () => {
    const env = validateEnv(BASE);
    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.API_PORT).toBe(4000);
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.AUTH_MAX_FAILED_LOGINS).toBe(5);
  });

  it('convertit les nombres et booléens fournis sous forme de texte', () => {
    const env = validateEnv({
      ...BASE,
      API_PORT: '4100',
      COOKIE_SECURE: 'false',
      TRUST_PROXY: '1',
    });
    expect(env.API_PORT).toBe(4100);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.TRUST_PROXY).toBe(1);
  });

  it('refuse un environnement inconnu sans divulguer la valeur', () => {
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'staging-secret' })).toThrow(/NODE_ENV/);
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'staging-secret' })).not.toThrow(
      /staging-secret/,
    );
  });

  it('refuse un port hors limites', () => {
    expect(() => validateEnv({ ...BASE, API_PORT: '70000' })).toThrow(/API_PORT/);
  });

  it.each(['DATABASE_URL', 'REDIS_URL', 'APP_URL', 'APP_ENCRYPTION_KEY', 'SMTP_HOST', 'MAIL_FROM'])(
    'exige %s',
    (name) => {
      const env: Record<string, unknown> = { ...BASE };
      delete env[name];
      expect(() => validateEnv(env)).toThrow(new RegExp(name));
    },
  );

  it('refuse une clé de chiffrement qui ne fait pas 32 octets', () => {
    expect(() =>
      validateEnv({ ...BASE, APP_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') }),
    ).toThrow(/APP_ENCRYPTION_KEY/);
  });

  it('refuse une URL de base invalide sans divulguer son contenu', () => {
    const env = { ...BASE, DATABASE_URL: 'mysql://user:secret-value@host/db' };
    expect(() => validateEnv(env)).toThrow(/DATABASE_URL/);
    expect(() => validateEnv(env)).not.toThrow(/secret-value/);
  });

  it('impose des cookies sécurisés en production', () => {
    expect(() => validateEnv({ ...BASE, NODE_ENV: 'production', COOKIE_SECURE: 'false' })).toThrow(
      /COOKIE_SECURE/,
    );
  });
});
