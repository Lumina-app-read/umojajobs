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

/**
 * Mise à jour du profil et des préférences. Tous les champs sont facultatifs ;
 * `phoneE164: null` retire le numéro (format E.164, par exemple « +221771234567 »).
 */
export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  countryIso2?: string;
  phoneE164?: string | null;
  locale?: Locale;
  theme?: ThemePreference;
}

/** Session active (appareil connecté). Les dates sont au format ISO 8601. */
export interface SessionResponse {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

/** Événement du journal de sécurité (administration, lecture seule). */
export interface SecurityEventResponse {
  id: string;
  type: string;
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata: unknown;
  createdAt: string;
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
  phoneE164: string | null;
  locale: Locale;
  theme: ThemePreference;
  roles: RoleCode[] | string[];
  permissions: string[];
  mfaState: MfaState;
  totpEnabled: boolean;
  /** Conditions de publication acceptées dans leur version en vigueur. */
  contributorTermsAccepted: boolean;
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
