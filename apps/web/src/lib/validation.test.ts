import { describe, expect, it } from 'vitest';
import {
  validateConfirmation,
  validateEmail,
  validateNewPassword,
  validatePersonName,
  validateRecoveryCode,
  validateRegister,
  validateTotpCode,
} from './validation';

describe('validation côté navigateur', () => {
  it('email', () => {
    expect(validateEmail('')).toEqual({ key: 'required' });
    expect(validateEmail('pas-un-email')).toEqual({ key: 'email' });
    expect(validateEmail('  awa@example.com ')).toBeUndefined();
  });

  it('nom de personne (lettres de toutes langues, apostrophes, traits d’union)', () => {
    expect(validatePersonName("N'Dri Kouamé-Yao")).toBeUndefined();
    expect(validatePersonName('Awa2')).toEqual({ key: 'personName' });
    expect(validatePersonName('   ')).toEqual({ key: 'required' });
    expect(validatePersonName('a'.repeat(101))).toEqual({ key: 'maxLength', values: { max: 100 } });
  });

  it('mot de passe : 12 caractères minimum, confirmation identique', () => {
    expect(validateNewPassword('court')).toEqual({ key: 'minLength', values: { min: 12 } });
    expect(validateNewPassword('une phrase de passe')).toBeUndefined();
    expect(validateConfirmation('abc', 'abd')).toEqual({ key: 'passwordMismatch' });
    expect(validateConfirmation('abc', 'abc')).toBeUndefined();
  });

  it('codes TOTP et de secours', () => {
    expect(validateTotpCode('123456')).toBeUndefined();
    expect(validateTotpCode('12345')).toEqual({ key: 'totpCode' });
    expect(validateRecoveryCode('ABCDE-FGH23')).toBeUndefined();
    expect(validateRecoveryCode('ABCDE')).toEqual({ key: 'recoveryCode' });
  });

  it('inscription : signale chaque champ manquant, y compris le pays et les conditions', () => {
    const errors = validateRegister({
      firstName: '',
      lastName: '',
      email: '',
      countryIso2: '',
      password: '',
      passwordConfirmation: '',
      acceptTerms: false,
    });
    expect(Object.keys(errors).sort()).toEqual(
      [
        'acceptTerms',
        'countryIso2',
        'email',
        'firstName',
        'lastName',
        'password',
        'passwordConfirmation',
      ].sort(),
    );
    expect(errors.countryIso2).toEqual({ key: 'country' });
    expect(errors.acceptTerms).toEqual({ key: 'terms' });
  });
});
