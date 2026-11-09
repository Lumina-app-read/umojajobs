import { type ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../../config/env.validation';
import { EncryptionService } from './encryption.service';

function createService(key = Buffer.alloc(32, 1).toString('base64')): EncryptionService {
  const config = { get: () => key } as unknown as ConfigService<EnvironmentVariables, true>;
  return new EncryptionService(config);
}

describe('EncryptionService', () => {
  it('chiffre puis déchiffre à l’identique', () => {
    const service = createService();
    const encrypted = service.encrypt('JBSWY3DPEHPK3PXP');
    expect(encrypted).not.toContain('JBSWY3DPEHPK3PXP');
    expect(service.decrypt(encrypted)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('produit un résultat différent à chaque chiffrement (IV aléatoire)', () => {
    const service = createService();
    expect(service.encrypt('secret')).not.toBe(service.encrypt('secret'));
  });

  it('détecte une altération du texte chiffré', () => {
    const service = createService();
    const parts = service.encrypt('secret').split('.');
    const tampered = Buffer.from(parts[3] ?? '', 'base64url');
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    parts[3] = tampered.toString('base64url');
    expect(() => service.decrypt(parts.join('.'))).toThrow();
  });

  it('refuse de déchiffrer avec une autre clé', () => {
    const encrypted = createService().encrypt('secret');
    expect(() =>
      createService(Buffer.alloc(32, 2).toString('base64')).decrypt(encrypted),
    ).toThrow();
  });

  it('refuse une clé de mauvaise taille', () => {
    expect(() => createService(Buffer.alloc(16).toString('base64'))).toThrow(/32 octets/);
  });
});
