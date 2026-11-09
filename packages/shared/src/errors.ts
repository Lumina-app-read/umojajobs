/**
 * Codes d'erreur renvoyés par l'API dans le champ `code`. Le frontend les traduit :
 * aucun message d'erreur destiné à l'utilisateur n'est rédigé côté API.
 */
export const ERROR_CODES = {
  // Génériques
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  CSRF_INVALID: 'CSRF_INVALID',

  // Référentiel
  COUNTRY_NOT_FOUND: 'COUNTRY_NOT_FOUND',

  // Authentification
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  PASSWORD_MISMATCH: 'PASSWORD_MISMATCH',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  TERMS_NOT_ACCEPTED: 'TERMS_NOT_ACCEPTED',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',

  // Double authentification
  MFA_REQUIRED: 'MFA_REQUIRED',
  MFA_ENROLLMENT_REQUIRED: 'MFA_ENROLLMENT_REQUIRED',
  MFA_INVALID_CODE: 'MFA_INVALID_CODE',
  MFA_ALREADY_ENABLED: 'MFA_ALREADY_ENABLED',
  MFA_SETUP_NOT_STARTED: 'MFA_SETUP_NOT_STARTED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Format unique des réponses d'erreur de l'API. */
export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  requestId: string;
  /** Détails de validation : champ concerné et règles non respectées. */
  details?: { field: string; rules: string[] }[];
  /** Informations complémentaires sans donnée sensible (par exemple l'état MFA). */
  meta?: Record<string, unknown>;
}
