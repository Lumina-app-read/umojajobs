/**
 * Contrats de l'API REST partagés entre le frontend et le backend.
 * Les DTO NestJS les implémentent (`implements`) : toute divergence est détectée à la compilation.
 * Les dates sont transmises en JSON sous forme de chaînes ISO 8601.
 */
import { type MfaState, type RoleCode, type ThemePreference } from './auth';
import { type Locale } from './locales';

export interface AcceptedResponse {
  status: 'accepted';
}

export interface CsrfTokenResponse {
  csrfToken: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  countryIso2: string;
  password: string;
  passwordConfirmation: string;
  acceptTerms: boolean;
  locale?: Locale;
}

export interface EmailRequest {
  email: string;
}

export interface LoginRequest extends EmailRequest {
  password: string;
}

export interface TokenRequest {
  token: string;
}

export interface ResetPasswordRequest extends TokenRequest {
  password: string;
  passwordConfirmation: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirmation: string;
}

export interface TotpCodeRequest {
  code: string;
}

export interface MfaVerifyRequest {
  code?: string;
  recoveryCode?: string;
}

export interface MeResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  countryIso2: string;
  locale: Locale;
  theme: ThemePreference;
  roles: RoleCode[] | string[];
  permissions: string[];
  mfaState: MfaState;
  totpEnabled: boolean;
}

export interface LoginResponse {
  user: MeResponse;
  csrfToken: string;
}

export interface TotpSetupResponse {
  secret: string;
  otpauthUri: string;
}

export interface RecoveryCodesResponse {
  recoveryCodes: string[];
}

export interface CountryResponse {
  iso2: string;
  iso3: string;
  nameFr: string;
  nameEn: string;
  officialNameFr: string;
  officialNameEn: string;
  dialCode: string;
  flagEmoji: string;
  currencyCode: string;
  defaultTimezone: string;
}

export interface CityResponse {
  id: string;
  name: string;
  regionName: string | null;
  population: number;
  timezone: string;
}
