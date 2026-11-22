import { REGISTRY_MAX_PAGE } from '@opportinities/shared';
import { firstParam, type SearchParams } from '@/features/jobs/routes';

export interface RegistryState<Status extends string> {
  q: string;
  status: Status | null;
  page: number;
}

/** État d'un registre porté par l'adresse : recherche, état et page, tous bornés. */
export function readRegistryState<Status extends string>(
  params: SearchParams,
  statuses: readonly Status[],
): RegistryState<Status> {
  const status = firstParam(params.status);
  const page = Number(firstParam(params.page));
  return {
    q: (firstParam(params.q) ?? '').trim().slice(0, 120),
    status: statuses.find((value) => value === status) ?? null,
    page: Number.isInteger(page) ? Math.min(REGISTRY_MAX_PAGE, Math.max(1, page)) : 1,
  };
}

/** Adresse d'un registre ; changer de recherche ou d'état revient à la première page. */
export function registryHref(
  base: string,
  state: { q?: string; status?: string | null; page?: number },
): string {
  const query = new URLSearchParams();
  if (state.q) query.set('q', state.q);
  if (state.status) query.set('status', state.status);
  if (state.page && state.page > 1) query.set('page', String(state.page));
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}
