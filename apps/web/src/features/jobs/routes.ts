/**
 * Racine des écrans d'offres : le site public pour les visiteurs, l'espace personnel pour
 * les utilisateurs connectés. Les mêmes vues servent les deux.
 */
export type JobsBase = '/jobs' | '/dashboard/jobs';

export type SearchParams = Record<string, string | string[] | undefined>;

export const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Reconstruit la chaîne de requête d'une adresse (pour une redirection fidèle). */
export function queryString(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = firstParam(value);
    if (first !== undefined) query.set(key, first);
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** Page demandée, bornée (la recherche ne pagine pas au-delà de 500 pages). */
export const pageParam = (params: SearchParams): number =>
  Math.max(1, Math.min(500, Number(firstParam(params.page)) || 1));

/** Identifiant public d'une offre (contrôlé avant tout appel ou redirection). */
export const isJobSlug = (slug: string): boolean => /^[a-z0-9-]{1,180}$/.test(slug);
