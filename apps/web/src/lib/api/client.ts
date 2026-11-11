import { type CsrfTokenResponse, ERROR_CODES } from '@opportinities/shared';
import { ApiError } from './errors';

/** Préfixe des routes de l'API, relayées vers NestJS sur la même origine (proxy Next.js ou Nginx). */
export const API_BASE = '/api/v1';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let csrfToken: string | null = null;

/** Mémorise le jeton CSRF renvoyé par l'API (notamment à la connexion, qui le renouvelle). */
export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'same-origin' });
  if (!response.ok) throw ApiError.fromBody(response.status, await safeJson(response));
  csrfToken = ((await response.json()) as CsrfTokenResponse).csrfToken;
  return csrfToken;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Appel de l'API depuis le navigateur. Ajoute le jeton CSRF aux requêtes qui modifient des données,
 * le renouvelle une fois s'il a expiré, et transforme les erreurs en ApiError (codes traduisibles).
 */
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  retried = false,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (UNSAFE_METHODS.has(method)) headers['X-CSRF-Token'] = await ensureCsrfToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK');
  }

  if (!response.ok) {
    const error = ApiError.fromBody(response.status, await safeJson(response));
    if (error.code === ERROR_CODES.CSRF_INVALID && !retried) {
      setCsrfToken(null);
      return apiRequest<T>(method, path, body, true);
    }
    throw error;
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Envoi d'un fichier (multipart). Le navigateur fixe lui-même l'en-tête Content-Type et la
 * frontière ; le jeton CSRF est ajouté comme pour toute requête qui modifie des données.
 */
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-CSRF-Token': await ensureCsrfToken() },
      credentials: 'same-origin',
      body: form,
    });
  } catch {
    throw new ApiError(0, 'NETWORK');
  }
  if (!response.ok) throw ApiError.fromBody(response.status, await safeJson(response));
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>('GET', path),
  post: <T>(path: string, body?: unknown) => apiRequest<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => apiRequest<T>('PATCH', path, body),
  delete: <T>(path: string) => apiRequest<T>('DELETE', path),
};
