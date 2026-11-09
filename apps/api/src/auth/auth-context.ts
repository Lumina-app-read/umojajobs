import { type MfaState, type RoleCode } from '@opportinities/shared';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  countryIso2: string;
  locale: 'fr' | 'en';
  theme: 'light' | 'dark' | 'system';
  totpEnabled: boolean;
}

/** Contexte d'authentification attaché à la requête par le guard de session. */
export interface AuthContext {
  user: AuthUser;
  sessionId: string;
  roles: RoleCode[];
  permissions: ReadonlySet<string>;
  mfaState: MfaState;
}
