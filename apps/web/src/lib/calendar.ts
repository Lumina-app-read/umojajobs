/**
 * Calcul de calendrier sans fuseau horaire : une date est un triplet année, mois (1-12), jour.
 * Les valeurs échangées avec les formulaires et l'API restent celles qu'ils attendent :
 * « AAAA-MM-JJ » (précision jour) ou « AAAA-MM » (précision mois). Aucun objet Date local n'est
 * utilisé pour le calcul, donc aucun décalage d'un jour selon le fuseau de l'appareil.
 */

export type DatePrecision = 'day' | 'month';

export interface CalendarDate {
  year: number;
  month: number;
  /** 1 en précision mois. */
  day: number;
}

const DAY_VALUE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_VALUE = /^(\d{4})-(\d{2})$/;

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Lit une valeur de formulaire ; null si elle est vide ou n'est pas une date réelle. */
export function parseDateValue(value: string, precision: DatePrecision): CalendarDate | null {
  const match = (precision === 'day' ? DAY_VALUE : MONTH_VALUE).exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = precision === 'day' ? Number(match[3]) : 1;
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

export function formatDateValue(date: CalendarDate, precision: DatePrecision): string {
  const month = `${pad(date.year, 4)}-${pad(date.month)}`;
  return precision === 'day' ? `${month}-${pad(date.day)}` : month;
}

/** Comparaison (négatif, nul ou positif) à la précision donnée. */
export function compareDates(a: CalendarDate, b: CalendarDate, precision: DatePrecision): number {
  return a.year - b.year || a.month - b.month || (precision === 'day' ? a.day - b.day : 0);
}

export function isWithin(
  date: CalendarDate,
  precision: DatePrecision,
  min: CalendarDate | null,
  max: CalendarDate | null,
): boolean {
  return (
    (!min || compareDates(date, min, precision) >= 0) &&
    (!max || compareDates(date, max, precision) <= 0)
  );
}

/** Ajoute des jours (navigation au clavier), en passant d'un mois ou d'une année à l'autre. */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const moved = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: moved.getUTCFullYear(), month: moved.getUTCMonth() + 1, day: moved.getUTCDate() };
}

/** Mois voisin ; le jour est ramené au dernier jour du mois s'il le dépasse (31 → 30). */
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const index = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

/** Jour de la semaine, 0 = lundi … 6 = dimanche. */
export function weekdayMondayFirst(date: CalendarDate): number {
  return (new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 6) % 7;
}

/**
 * Cases d'un mois affiché, semaines commençant le lundi : null pour les cases vides avant le
 * premier jour et après le dernier (la grille compte toujours un nombre entier de semaines).
 */
export function monthGrid(year: number, month: number): (CalendarDate | null)[] {
  const leading = weekdayMondayFirst({ year, month, day: 1 });
  const total = daysInMonth(year, month);
  const cells: (CalendarDate | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= total; day += 1) cells.push({ year, month, day });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Date du jour sur l'appareil de l'utilisateur (son jour calendaire, pas celui de l'UTC). */
export function today(now: Date = new Date()): CalendarDate {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/** Objet Date à midi UTC, pour l'affichage avec Intl en timeZone « UTC » (aucun décalage). */
export const toDisplayDate = (date: CalendarDate): Date =>
  new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
