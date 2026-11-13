import { randomBytes } from 'node:crypto';
import { type ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../config/env.validation';
import { RenderTokenService } from './render-token';

describe('Career Studio : jeton de la page d’impression', () => {
  const config = {
    get: () => randomBytes(32).toString('base64'),
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const tokens = new RenderTokenService(config);
  const exportId = '01a1cffd-3764-77ba-925d-d1a9b1996e11';

  it('n’ouvre que l’export pour lequel il a été émis, pendant deux minutes', () => {
    const now = Date.now();
    const token = tokens.issue(exportId, now);
    expect(tokens.verify(exportId, token, now + 60_000)).toBe(true);
    expect(tokens.verify(exportId, token, now + 3 * 60_000)).toBe(false);
    expect(tokens.verify('01a1cffd-3764-77ba-925d-d1a9b1996e12', token, now)).toBe(false);
  });

  it('refuse un jeton modifié ou mal formé', () => {
    const now = Date.now();
    const [expires, signature] = tokens.issue(exportId, now).split('.');
    expect(tokens.verify(exportId, `${Number(expires) + 600_000}.${signature}`, now)).toBe(false);
    expect(tokens.verify(exportId, `${expires}.${signature?.slice(1)}`, now)).toBe(false);
    expect(tokens.verify(exportId, 'n-importe-quoi', now)).toBe(false);
    // Une autre clé (autre installation) ne produit jamais un jeton valide ici.
    expect(tokens.verify(exportId, new RenderTokenService(config).issue(exportId, now), now)).toBe(
      false,
    );
  });
});
