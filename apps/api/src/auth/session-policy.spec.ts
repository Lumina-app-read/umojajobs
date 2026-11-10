import { isSessionUsable, type SessionLimits } from './session-policy';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const standard: SessionLimits = { maxAgeMs: 30 * DAY, idleMs: 7 * DAY };
const MINUTE = 60 * 1000;
const privileged: SessionLimits = { maxAgeMs: 6 * HOUR, idleMs: 15 * MINUTE };

const start = Date.UTC(2026, 10, 10, 8, 0, 0);
const session = (lastSeenOffsetMs: number) => ({
  createdAt: new Date(start),
  lastSeenAt: new Date(start + lastSeenOffsetMs),
  expiresAt: new Date(start + 30 * DAY),
});

describe('politique de durée des sessions', () => {
  it('accepte une session récente, ordinaire ou privilégiée', () => {
    expect(isSessionUsable(session(0), start + 10 * MINUTE, standard, null)).toBe(true);
    expect(isSessionUsable(session(0), start + 10 * MINUTE, standard, privileged)).toBe(true);
  });

  it('refuse une session privilégiée inactive depuis plus de 15 minutes', () => {
    const now = start + 16 * MINUTE;
    expect(isSessionUsable(session(0), now, standard, privileged)).toBe(false);
    // Le même délai reste acceptable pour un compte ordinaire.
    expect(isSessionUsable(session(0), now, standard, null)).toBe(true);
  });

  it('refuse une session privilégiée ouverte depuis plus de 6 heures, même active', () => {
    const now = start + 7 * HOUR;
    expect(isSessionUsable(session(7 * HOUR - MINUTE), now, standard, privileged)).toBe(false);
    expect(isSessionUsable(session(7 * HOUR - MINUTE), now, standard, null)).toBe(true);
  });

  it('respecte toujours la date d’expiration fixée à l’ouverture', () => {
    const now = start + 30 * DAY;
    expect(isSessionUsable(session(30 * DAY - 60_000), now, standard, null)).toBe(false);
  });

  it('refuse une session ordinaire inactive au-delà du délai standard', () => {
    expect(isSessionUsable(session(0), start + 8 * DAY, standard, null)).toBe(false);
  });
});
