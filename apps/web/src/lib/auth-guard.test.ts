import { type MfaState } from '@opportinities/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUser = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({ getLocale: () => Promise.resolve('fr') }));
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ redirect: vi.fn() }));
vi.mock('./api/server', () => ({ getCurrentUser }));

const { hasPermission } = await import('./auth-guard');

const session = (mfaState: MfaState) => ({ data: { mfaState, permissions: ['jobs.moderate'] } });

describe('hasPermission', () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
  });

  it.each([
    ['not_required', true],
    ['verified', true],
    ['enrollment_required', false],
    ['verification_required', false],
  ] as const)('double authentification « %s » : %s', async (state, expected) => {
    getCurrentUser.mockResolvedValue(session(state));
    expect(await hasPermission('jobs.moderate')).toBe(expected);
  });

  it('refuse une permission absente, un visiteur et une API injoignable', async () => {
    getCurrentUser.mockResolvedValueOnce(session('verified'));
    expect(await hasPermission('finance.manage')).toBe(false);
    getCurrentUser.mockResolvedValueOnce({ data: null });
    expect(await hasPermission('jobs.moderate')).toBe(false);
    getCurrentUser.mockRejectedValueOnce(new Error('API injoignable'));
    expect(await hasPermission('jobs.moderate')).toBe(false);
  });
});
