import { type ApiErrorBody, ERROR_CODES, type ErrorCode } from '@opportinities/shared';

/** Erreur renvoyée par l'API (format unique { statusCode, code, requestId, details?, meta? }). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    readonly details: ApiErrorBody['details'] = [],
    readonly meta: Record<string, unknown> = {},
    readonly requestId?: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }

  static fromBody(status: number, body: unknown): ApiError {
    const candidate = (body ?? {}) as Partial<ApiErrorBody>;
    const known = new Set<string>(Object.values(ERROR_CODES));
    const code =
      typeof candidate.code === 'string' && known.has(candidate.code)
        ? candidate.code
        : ERROR_CODES.INTERNAL_ERROR;
    return new ApiError(
      status,
      code,
      candidate.details ?? [],
      candidate.meta ?? {},
      candidate.requestId,
    );
  }
}

/** Paramètres d'interpolation du message traduit d'une erreur (par exemple les minutes de verrouillage). */
export function errorMessageValues(error: ApiError): Record<string, number> {
  const retryAfter = error.meta.retryAfterSeconds;
  if (typeof retryAfter === 'number') {
    return { minutes: Math.max(1, Math.ceil(retryAfter / 60)) };
  }
  return { minutes: 1 };
}

/** Règle de validation renvoyée par l'API → clé du catalogue « validation ». */
const RULE_TO_MESSAGE: Record<string, string> = {
  isEmail: 'email',
  isNotEmpty: 'required',
  isDefined: 'required',
  isString: 'required',
  isIn: 'country',
  equals: 'terms',
  matches: 'invalid',
  minLength: 'invalid',
  maxLength: 'invalid',
  isLength: 'invalid',
};

/** Erreurs par champ, issues des détails de validation de l'API. */
export function fieldErrorKeys(error: ApiError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const detail of error.details ?? []) {
    const rule = detail.rules[0];
    result[detail.field] = (rule && RULE_TO_MESSAGE[rule]) ?? 'invalid';
  }
  return result;
}
