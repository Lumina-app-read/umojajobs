import { NodeEnv, validateEnv } from './env.validation';

const DATABASE_URL = 'postgresql://user:secret-value@localhost:5432/db';

describe('validateEnv', () => {
  it('applique les valeurs par défaut', () => {
    const env = validateEnv({ DATABASE_URL });
    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.API_PORT).toBe(4000);
  });

  it('convertit le port fourni sous forme de texte', () => {
    expect(validateEnv({ DATABASE_URL, API_PORT: '4100' }).API_PORT).toBe(4100);
  });

  it('refuse un environnement inconnu sans divulguer la valeur', () => {
    expect(() => validateEnv({ DATABASE_URL, NODE_ENV: 'staging-secret' })).toThrow(/NODE_ENV/);
    expect(() => validateEnv({ DATABASE_URL, NODE_ENV: 'staging-secret' })).not.toThrow(
      /staging-secret/,
    );
  });

  it('refuse un port hors limites', () => {
    expect(() => validateEnv({ DATABASE_URL, API_PORT: '70000' })).toThrow(/API_PORT/);
  });

  it('exige DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuse une URL de base invalide sans divulguer son contenu', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://user:secret-value@host/db' })).toThrow(
      /DATABASE_URL/,
    );
    expect(() => validateEnv({ DATABASE_URL: 'mysql://user:secret-value@host/db' })).not.toThrow(
      /secret-value/,
    );
  });
});
