import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '@/test/render';
import { api, setCsrfToken } from './client';
import { ApiError, errorMessageValues, fieldErrorKeys } from './errors';

describe('client API du navigateur', () => {
  beforeEach(() => {
    setCsrfToken(null);
  });

  it('récupère le jeton CSRF puis l’envoie dans X-CSRF-Token', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'jeton-csrf' }))
      .mockResolvedValueOnce(jsonResponse(202, { status: 'accepted' }));

    await expect(api.post('/auth/register', { email: 'a@b.co' })).resolves.toEqual({
      status: 'accepted',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/auth/csrf', {
      credentials: 'same-origin',
    });
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/register');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('jeton-csrf');
    expect(init.credentials).toBe('same-origin');
  });

  it('n’envoie pas de jeton CSRF pour une lecture', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse(200, []));
    await api.get('/countries');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBeUndefined();
  });

  it('renouvelle une fois un jeton CSRF expiré', async () => {
    setCsrfToken('ancien');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(403, { statusCode: 403, code: 'CSRF_INVALID', requestId: 'r1' }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { csrfToken: 'nouveau' }))
      .mockResolvedValueOnce(jsonResponse(204, undefined));

    await expect(api.post('/auth/logout')).resolves.toBeUndefined();
    const [, retry] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect((retry.headers as Record<string, string>)['X-CSRF-Token']).toBe('nouveau');
  });

  it('transforme une erreur de l’API en ApiError avec son code', async () => {
    setCsrfToken('jeton');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(401, { statusCode: 401, code: 'INVALID_CREDENTIALS', requestId: 'r2' }),
    );
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      requestId: 'r2',
    });
  });

  it('remplace un code inconnu par INTERNAL_ERROR et signale une panne réseau', async () => {
    setCsrfToken('jeton');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(500, { code: 'QUELQUE_CHOSE' }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.post('/x')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    await expect(api.post('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('convertit le délai de verrouillage en minutes et les détails en erreurs de champ', () => {
    const locked = new ApiError(429, 'ACCOUNT_LOCKED', [], { retryAfterSeconds: 61 });
    expect(errorMessageValues(locked)).toEqual({ minutes: 2 });
    const invalid = new ApiError(400, 'VALIDATION_FAILED', [
      { field: 'email', rules: ['isEmail'] },
      { field: 'countryIso2', rules: ['isIn'] },
    ]);
    expect(fieldErrorKeys(invalid)).toEqual({ email: 'email', countryIso2: 'country' });
  });
});
