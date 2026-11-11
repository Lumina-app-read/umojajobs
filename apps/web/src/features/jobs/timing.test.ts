import { describe, expect, it } from 'vitest';
import { jobTiming } from './timing';

const now = new Date('2026-11-11T12:00:00Z');
const inHours = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString();

describe('jobTiming', () => {
  it('signale une offre en cours lorsque l’échéance est lointaine', () => {
    expect(jobTiming('active', inHours(24 * 10), now)).toEqual({ state: 'open' });
    expect(jobTiming('active', inHours(24 * 3), now)).toEqual({ state: 'open' });
  });

  it('signale une expiration proche dans les trois derniers jours', () => {
    expect(jobTiming('active', inHours(24 * 3 - 1), now)).toEqual({
      state: 'closing',
      daysLeft: 2,
    });
    expect(jobTiming('active', inHours(5), now)).toEqual({ state: 'closing', daysLeft: 0 });
  });

  it('signale une offre expirée par statut ou par échéance dépassée', () => {
    expect(jobTiming('expired', inHours(24 * 10), now)).toEqual({ state: 'expired' });
    expect(jobTiming('active', inHours(-1), now)).toEqual({ state: 'expired' });
  });
});
