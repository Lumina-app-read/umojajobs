import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  compareDates,
  daysInMonth,
  formatDateValue,
  isWithin,
  monthGrid,
  parseDateValue,
  today,
  toDisplayDate,
} from './calendar';

describe('calendrier sans fuseau horaire', () => {
  it('lit les valeurs au format de l’API et refuse les dates impossibles ou le texte libre', () => {
    expect(parseDateValue('2026-11-25', 'day')).toEqual({ year: 2026, month: 11, day: 25 });
    expect(parseDateValue('2024-03', 'month')).toEqual({ year: 2024, month: 3, day: 1 });
    expect(parseDateValue('2025-02-29', 'day')).toBeNull();
    expect(parseDateValue('2024-02-29', 'day')).not.toBeNull();
    expect(parseDateValue('2024-13', 'month')).toBeNull();
    expect(parseDateValue('1er mars 2021', 'day')).toBeNull();
    expect(parseDateValue('', 'day')).toBeNull();
    expect(parseDateValue('2024-03-01', 'month')).toBeNull();
  });

  it('écrit exactement le format attendu (aller-retour sans perte)', () => {
    expect(formatDateValue({ year: 2026, month: 1, day: 5 }, 'day')).toBe('2026-01-05');
    expect(formatDateValue({ year: 2026, month: 1, day: 5 }, 'month')).toBe('2026-01');
    for (const value of ['2000-01-01', '2026-12-31', '1975-06-15']) {
      expect(formatDateValue(parseDateValue(value, 'day')!, 'day')).toBe(value);
    }
  });

  it('gère les années bissextiles et la fin des mois', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
    expect(addMonths({ year: 2026, month: 12, day: 15 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 15,
    });
    expect(addMonths({ year: 2026, month: 1, day: 15 }, -1)).toEqual({
      year: 2025,
      month: 12,
      day: 15,
    });
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
  });

  it('compare et borne à la précision demandée', () => {
    const a = { year: 2026, month: 3, day: 10 };
    const b = { year: 2026, month: 3, day: 20 };
    expect(compareDates(a, b, 'day')).toBeLessThan(0);
    expect(compareDates(a, b, 'month')).toBe(0);
    expect(isWithin(a, 'day', b, null)).toBe(false);
    expect(isWithin(a, 'month', b, null)).toBe(true);
  });

  it('construit des semaines commençant le lundi', () => {
    // Novembre 2026 commence un dimanche : six cases vides avant le 1er.
    const grid = monthGrid(2026, 11);
    expect(grid.slice(0, 6).every((cell) => cell === null)).toBe(true);
    expect(grid[6]).toEqual({ year: 2026, month: 11, day: 1 });
    expect(grid.length % 7).toBe(0);
    expect(grid.filter(Boolean)).toHaveLength(30);
  });

  it('prend le jour calendaire de l’appareil, et affiche sans décalage', () => {
    // 23 h 30 locale : le jour reste le 25, même si l'UTC est déjà au lendemain.
    expect(today(new Date(2026, 10, 25, 23, 30))).toEqual({ year: 2026, month: 11, day: 25 });
    const shown = new Intl.DateTimeFormat('fr', { dateStyle: 'long', timeZone: 'UTC' }).format(
      toDisplayDate({ year: 2026, month: 1, day: 1 }),
    );
    expect(shown).toBe('1 janvier 2026');
  });
});
