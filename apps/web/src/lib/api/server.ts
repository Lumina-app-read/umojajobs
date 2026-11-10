import 'server-only';
import {
  type CountryResponse,
  type MeResponse,
  type SecurityEventResponse,
  type SessionResponse,
} from '@opportinities/shared';
import { cookies } from 'next/headers';
import { cache } from 'react';

/** Adresse interne de l'API, utilisée par les Server Components (jamais exposée au navigateur). */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

interface ServerResult<T> {
  status: number;
  data: T | null;
  code: string | null;
}

/** Appel de l'API côté serveur, en transmettant les cookies de la requête (session). */
async function serverGet<T>(path: string): Promise<ServerResult<T>> {
  const cookieStore = await cookies();
  const response = await fetch(`${API_INTERNAL_URL}/api/v1${path}`, {
    headers: { Accept: 'application/json', Cookie: cookieStore.toString() },
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const code = (body as { code?: unknown } | null)?.code;
    return { status: response.status, data: null, code: typeof code === 'string' ? code : null };
  }
  return { status: response.status, data: body as T, code: null };
}

/**
 * Utilisateur connecté, ou état d'authentification à traiter par la page appelante.
 * Mis en cache pour la durée d'une requête : en-tête, mise en page et page partagent un seul appel.
 */
export const getCurrentUser = cache((): Promise<ServerResult<MeResponse>> =>
  serverGet<MeResponse>('/auth/me'),
);

/** Pays actifs (référentiel administrable). */
export async function getCountries(): Promise<CountryResponse[]> {
  const result = await serverGet<CountryResponse[]>('/countries');
  if (!result.data) {
    throw new Error(`Référentiel des pays indisponible (HTTP ${result.status}).`);
  }
  return result.data;
}

/** Sessions actives de l'utilisateur connecté (liste vide si l'API ne répond pas). */
export async function getSessions(): Promise<SessionResponse[]> {
  const result = await serverGet<SessionResponse[]>('/auth/sessions').catch(() => null);
  return result?.data ?? [];
}

/** Journal de sécurité (administration). data null si l'API refuse ou ne répond pas. */
export async function getSecurityEvents(query: {
  type?: string;
  before?: string;
  limit: number;
}): Promise<SecurityEventResponse[] | null> {
  const params = new URLSearchParams({ limit: String(query.limit) });
  if (query.type) params.set('type', query.type);
  if (query.before) params.set('before', query.before);
  const result = await serverGet<SecurityEventResponse[]>(
    `/admin/security-events?${params.toString()}`,
  ).catch(() => null);
  return result?.data ?? null;
}
