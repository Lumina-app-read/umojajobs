import { type SearchParams } from './routes';

/** Paramètres d'une page par lieu ou catégorie : le filtre de la page, puis la page demandée. */
export function landingParams(fixed: Record<string, string>, params: SearchParams): SearchParams {
  return { ...params, ...fixed };
}

/** Une page vide n'est pas proposée aux moteurs (contenu sans valeur) ; elle reste consultable. */
export function landingRobots(total: number | undefined) {
  return total ? undefined : { index: false, follow: true };
}
