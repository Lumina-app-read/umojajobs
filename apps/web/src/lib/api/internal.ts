import 'server-only';

/** Adresse interne de l'API (réseau Docker en production, localhost en développement). */
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * En-têtes des lectures publiques du serveur web. Le jeton interne (facultatif) exempte ces
 * lectures, mises en cache et partagées entre visiteurs, de la limite par adresse IP de l'API.
 */
export function publicHeaders(): Record<string, string> {
  const token = process.env.INTERNAL_API_TOKEN;
  return {
    Accept: 'application/json',
    ...(token ? { 'X-Internal-Token': token } : {}),
  };
}
