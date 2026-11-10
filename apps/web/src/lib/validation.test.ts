import { describe, expect, it } from 'vitest';
import {
  validateConfirmation,
  validateEmail,
  validateNewPassword,
  normalizePhone,
  validatePersonName,
  validatePhone,
  validateRecoveryCode,
  passwordContainsIdentity,
  validateRegister,
  validateRegisterStep,
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

describe('inscription en deux étapes', () => {
  const values = {
    firstName: 'Awa',
    lastName: 'Diallo',
    email: '',
    countryIso2: 'SN',
    password: '',
    passwordConfirmation: '',
    acceptTerms: false,
  };

  it('ne valide que les champs de l’étape demandée', () => {
    expect(validateRegisterStep(values, 0)).toEqual({});
    expect(Object.keys(validateRegisterStep(values, 1)).sort()).toEqual([
      'acceptTerms',
      'email',
      'password',
      'passwordConfirmation',
    ]);
  });

  it('repère le nom ou l’email dans le mot de passe (4 caractères ou plus)', () => {
    const identity = { firstName: 'Awa', lastName: 'Diallo', email: 'awa.d@example.com' };
    expect(passwordContainsIdentity('mon-DIALLO-2026', identity)).toBe(true);
    expect(passwordContainsIdentity('awa.d et la mer', identity)).toBe(true);
    // « Awa » fait moins de 4 caractères : il n'est pas pris en compte, comme dans l'API.
    expect(passwordContainsIdentity('awa aime la mer', identity)).toBe(false);
  });
});

describe('téléphone (E.164)', () => {
  it('accepte un numéro international saisi avec espaces, points ou tirets', () => {
    expect(normalizePhone('+221 77 123 45 67')).toBe('+221771234567');
    expect(normalizePhone('+225.07-12-34-56-78')).toBe('+2250712345678');
    expect(validatePhone('+221 77 123 45 67')).toBeUndefined();
  });

  it('considère un champ vide comme « pas de numéro »', () => {
    expect(normalizePhone('   ')).toBeNull();
    expect(validatePhone('')).toBeUndefined();
  });

  it('refuse un numéro local ou trop court', () => {
    expect(validatePhone('77 123 45 67')).toEqual({ key: 'phone' });
    expect(validatePhone('+2217')).toEqual({ key: 'phone' });
  });
});
