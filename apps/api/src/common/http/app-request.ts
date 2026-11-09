import { type Request } from 'express';
import { type AuthContext } from '../../auth/auth-context';

/** Requête Express enrichie par les middlewares et guards de l'application. */
export interface AppRequest extends Request {
  /** Identifiant de corrélation (en-tête X-Request-Id), présent sur chaque requête. */
  requestId: string;
  /** Contexte d'authentification, renseigné par le guard de session. */
  auth?: AuthContext;
  cookies: Record<string, string | undefined>;
}

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}

const USER_AGENT_MAX_LENGTH = 512;

/**
 * Informations client pour la journalisation. L'IP provient de `req.ip`, qui ne tient compte
 * de X-Forwarded-For que pour le nombre de proxys de confiance configuré (TRUST_PROXY).
 */
export function getClientInfo(req: AppRequest): ClientInfo {
  const userAgent = req.get('user-agent');
  return {
    ip: req.ip ?? null,
    userAgent: userAgent ? userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
    requestId: req.requestId,
  };
}
