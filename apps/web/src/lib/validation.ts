import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PERSON_NAME_MAX_LENGTH,
  PHONE_E164,
} from '@opportinities/shared';

/**
 * Validation côté navigateur, pour le confort de saisie uniquement : l'API revalide tout.
 * Chaque erreur est une clé du catalogue « validation » avec ses paramètres éventuels.
 */
export interface FieldError {
  key:
    | 'required'
    | 'email'
    | 'minLength'
    | 'maxLength'
    | 'personName'
    | 'country'
    | 'terms'
    | 'passwordMismatch'
    | 'totpCode'
    | 'recoveryCode'
    | 'phone'
    | 'invalid';
  values?: Record<string, number>;
}

export type FieldErrors<T extends string> = Partial<Record<T, FieldError>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;

export function validateEmail(value: string): FieldError | undefined {
  const email = value.trim();
  if (!email) return { key: 'required' };
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL.test(email)) return { key: 'email' };
  return undefined;
}

export function validatePersonName(value: string): FieldError | undefined {
  const name = value.trim();
  if (!name) return { key: 'required' };
  if (name.length > PERSON_NAME_MAX_LENGTH)
    return { key: 'maxLength', values: { max: PERSON_NAME_MAX_LENGTH } };
  if (!PERSON_NAME.test(name)) return { key: 'personName' };
  return undefined;
}

export function validateNewPassword(value: string): FieldError | undefined {
  if (!value) return { key: 'required' };
  if (value.length < PASSWORD_MIN_LENGTH)
    return { key: 'minLength', values: { min: PASSWORD_MIN_LENGTH } };
  if (value.length > PASSWORD_MAX_LENGTH)
    return { key: 'maxLength', values: { max: PASSWORD_MAX_LENGTH } };
  return undefined;
}

export function validateConfirmation(
  password: string,
  confirmation: string,
): FieldError | undefined {
  if (!confirmation) return { key: 'required' };
  return password === confirmation ? undefined : { key: 'passwordMismatch' };
}

export interface RegisterValues {
  firstName: string;
  lastName: string;
  email: string;
  countryIso2: string;
  password: string;
  passwordConfirmation: string;
  acceptTerms: boolean;
}

export function validateRegister(values: RegisterValues): FieldErrors<keyof RegisterValues> {
  const errors: FieldErrors<keyof RegisterValues> = {
    firstName: validatePersonName(values.firstName),
    lastName: validatePersonName(values.lastName),
    email: validateEmail(values.email),
    countryIso2: values.countryIso2 ? undefined : { key: 'country' },
    password: validateNewPassword(values.password),
    passwordConfirmation: validateConfirmation(values.password, values.passwordConfirmation),
    acceptTerms: values.acceptTerms ? undefined : { key: 'terms' },
  };
  return compact(errors);
}

/** Champs de chaque étape de l'inscription. */
export const REGISTER_STEPS = [
  ['firstName', 'lastName', 'countryIso2'],
  ['email', 'password', 'passwordConfirmation', 'acceptTerms'],
] as const satisfies readonly (readonly (keyof RegisterValues)[])[];

/** Validation limitée aux champs d'une étape. */
export function validateRegisterStep(
  values: RegisterValues,
  step: 0 | 1,
): FieldErrors<keyof RegisterValues> {
  const all = validateRegister(values);
  const fields: readonly (keyof RegisterValues)[] = REGISTER_STEPS[step];
  return compact(Object.fromEntries(fields.map((field) => [field, all[field]])));
}

/**
 * Le mot de passe contient-il le prénom, le nom ou la partie locale de l'email (4 caractères
 * ou plus) ? Reprend la règle de l'API pour l'afficher en direct ; l'API reste seule juge.
 */
export function passwordContainsIdentity(
  password: string,
  identity: { firstName: string; lastName: string; email: string },
): boolean {
  const lower = password.toLowerCase();
  return [identity.email.split('@')[0] ?? '', identity.firstName, identity.lastName]
    .map((part) => part.toLowerCase().trim())
    .filter((part) => part.length >= 4)
    .some((part) => lower.includes(part));
}

/** Téléphone saisi librement (« +221 77 123 45 67 ») ramené au format E.164 ; vide : aucun numéro. */
export function normalizePhone(value: string): string | null {
  const compact = value.replace(/[\s.()-]/g, '');
  return compact === '' ? null : compact;
}

export function validatePhone(value: string): FieldError | undefined {
  const phone = normalizePhone(value);
  return phone === null || PHONE_E164.test(phone) ? undefined : { key: 'phone' };
}

export function validateTotpCode(value: string): FieldError | undefined {
  return /^\d{6}$/.test(value.trim()) ? undefined : { key: 'totpCode' };
}

export function validateRecoveryCode(value: string): FieldError | undefined {
  return /^[A-Za-z2-7]{5}-?[A-Za-z2-7]{5}$/.test(value.trim())
    ? undefined
    : { key: 'recoveryCode' };
}

/** Retire les champs sans erreur. */
export function compact<T extends string>(errors: FieldErrors<T>): FieldErrors<T> {
  return Object.fromEntries(
    Object.entries(errors).filter(([, error]) => error !== undefined),
  ) as FieldErrors<T>;
}

export function hasErrors<T extends string>(errors: FieldErrors<T>): boolean {
  return Object.keys(errors).length > 0;
}
