import { NodeEnv, validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('applique les valeurs par défaut', () => {
    const env = validateEnv({});
    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.API_PORT).toBe(4000);
  });

  it('convertit le port fourni sous forme de texte', () => {
    expect(validateEnv({ API_PORT: '4100' }).API_PORT).toBe(4100);
  });

  it('refuse un environnement inconnu sans divulguer la valeur', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging-secret' })).toThrow(/NODE_ENV/);
    expect(() => validateEnv({ NODE_ENV: 'staging-secret' })).not.toThrow(/staging-secret/);
  });

  it('refuse un port hors limites', () => {
    expect(() => validateEnv({ API_PORT: '70000' })).toThrow(/API_PORT/);
  });
});
