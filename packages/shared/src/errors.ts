/**
 * Codes d'erreur renvoyés par l'API dans le champ `code`. Le frontend les traduit :
 * aucun message d'erreur destiné à l'utilisateur n'est rédigé côté API.
 * La liste est complétée au fil des modules (authentification en phase 1c, etc.).
 */
export const ERROR_CODES = {
  COUNTRY_NOT_FOUND: 'COUNTRY_NOT_FOUND',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
