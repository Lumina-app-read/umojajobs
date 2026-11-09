import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();
  const context = { email: 'awa.diallo@example.test', firstName: 'Awa', lastName: 'Diallo' };

  beforeAll(async () => {
    await service.onModuleInit();
  });

  it('hache en Argon2id et vérifie le bon mot de passe uniquement', async () => {
    const hashed = await service.hash('un mot de passe solide');
    expect(hashed.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hashed, 'un mot de passe solide')).resolves.toBe(true);
    await expect(service.verify(hashed, 'un autre mot de passe')).resolves.toBe(false);
  });

  it('renvoie false pour une empreinte corrompue sans lever d’erreur', async () => {
    await expect(service.verify('pas-une-empreinte', 'x')).resolves.toBe(false);
  });

  it('la vérification factice renvoie toujours false', async () => {
    await expect(service.verifyDummy('opportinities-dummy-password-for-timing')).resolves.toBe(
      false,
    );
  });

  it.each([
    ['trop court', 'Court1!'],
    ['trop long', 'a'.repeat(129) + 'Bcdef'],
    ['courant', 'Password1234'],
    ['caractères répétés', 'aaaaaaaaaaaaaaab'],
    ['contient l’identifiant email', 'awa.diallo-2026!'],
    ['contient le nom', 'xx-Diallo-forever'],
  ])('refuse un mot de passe faible (%s)', (_label, password) => {
    expect(service.isStrong(password, context)).toBe(false);
  });

  it('accepte une phrase de passe longue', () => {
    expect(service.isStrong('le baobab de Thiès fleurit en mai', context)).toBe(true);
  });

  it('lève PASSWORD_TOO_WEAK', () => {
    expect(() => service.assertStrong('Password1234', context)).toThrow(
      expect.objectContaining({ response: { code: 'PASSWORD_TOO_WEAK' } }) as Error,
    );
  });
});
