import { createHash } from 'node:crypto';
import { type JobOfferStatus, JOB_LIMITS } from '@opportinities/shared';
import { toSearchName } from '../locations/search-name';

// --- Statuts ---------------------------------------------------------------------------------

/**
 * Transitions autorisées (cahier des charges §7.4 et §7.5). Toute autre transition est refusée.
 * Les transitions « système » (activation, expiration) sont exécutées par les tâches planifiées.
 */
export const JOB_OFFER_TRANSITIONS: Readonly<Record<JobOfferStatus, readonly JobOfferStatus[]>> = {
  draft: ['pending_review'],
  needs_correction: ['pending_review'],
  pending_review: ['scheduled', 'active', 'rejected', 'needs_correction'],
  scheduled: ['active', 'suspended', 'expired'],
  active: ['expired', 'suspended'],
  suspended: ['scheduled', 'active', 'expired', 'archived'],
  expired: ['archived'],
  rejected: ['archived'],
  archived: [],
};

export function canTransition(from: JobOfferStatus, to: JobOfferStatus): boolean {
  return JOB_OFFER_TRANSITIONS[from].includes(to);
}

/** Statut d'une offre approuvée : programmée tant que sa date de début n'est pas atteinte. */
export function statusAfterApproval(startsAt: Date, now: Date): 'scheduled' | 'active' {
  return startsAt.getTime() > now.getTime() ? 'scheduled' : 'active';
}

// --- Dates et fuseaux horaires ---------------------------------------------------------------

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Date calendaire « AAAA-MM-JJ » valide (refuse le 31 février, etc.). */
export function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** Décalage (ms) entre l'heure locale du fuseau et UTC à un instant donné. */
function timezoneOffsetMs(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - instant;
}

/** Instant UTC correspondant à minuit (heure locale) d'une date calendaire dans un fuseau. */
export function startOfDayInTimezone(date: string, timezone: string): Date {
  const parsed = parseDateOnly(date);
  if (!parsed) throw new RangeError(`Date invalide : ${date}`);
  const naive = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  let utc = naive - timezoneOffsetMs(naive, timezone);
  // Second passage : corrige le cas où le décalage change autour de minuit (heure d'été).
  const corrected = naive - timezoneOffsetMs(utc, timezone);
  if (corrected !== utc) utc = corrected;
  return new Date(utc);
}

function addDays(date: string, days: number): string {
  const parsed = parseDateOnly(date);
  if (!parsed) throw new RangeError(`Date invalide : ${date}`);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
    .toISOString()
    .slice(0, 10);
}

/** Date calendaire « AAAA-MM-JJ » d'un instant dans un fuseau. */
export function todayInTimezone(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Fenêtre de validité d'une offre : du début du jour de début au début du jour suivant la date
 * de fin (fin exclusive), dans le fuseau de l'offre. Une offre valable « jusqu'au 30 juin » reste
 * donc active toute la journée du 30 juin, heure locale.
 */
export function validityWindow(
  startDate: string,
  endDate: string,
  timezone: string,
): { startsAt: Date; endsAt: Date } {
  return {
    startsAt: startOfDayInTimezone(startDate, timezone),
    endsAt: startOfDayInTimezone(addDays(endDate, 1), timezone),
  };
}

export type DatesProblem = 'invalid' | 'end_before_start' | 'already_ended' | 'too_long';

/** Contrôle des dates à la soumission et à la validation. */
export function checkValidityDates(
  startDate: string,
  endDate: string,
  timezone: string,
  now: Date,
): DatesProblem | null {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) return 'invalid';
  if (endDate < startDate) return 'end_before_start';
  if (endDate < todayInTimezone(now, timezone)) return 'already_ended';
  const days =
    (Date.UTC(end.year, end.month - 1, end.day) -
      Date.UTC(start.year, start.month - 1, start.day)) /
    86_400_000;
  if (days > JOB_LIMITS.validityMaxDays) return 'too_long';
  return null;
}

// --- Doublons --------------------------------------------------------------------------------

/**
 * Empreinte de détection des doublons : entreprise, intitulé et pays normalisés (casse, accents,
 * ponctuation ignorés). Deux annonces identiques partagées par des contributeurs différents
 * obtiennent la même empreinte et sont présentées ensemble au modérateur.
 */
export function duplicateKey(companyName: string, title: string, countryIso2: string): string {
  const normalized = [
    toSearchName(companyName),
    toSearchName(title),
    countryIso2.toUpperCase(),
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex');
}

// --- Complétude avant soumission ------------------------------------------------------------

export interface SubmissionFields {
  title: string | null;
  companyName: string | null;
  countryIso2: string | null;
  categoryId: string | null;
  contractType: string | null;
  workMode: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceType: string | null;
  applicationInstructions: string | null;
  applicationEmail: string | null;
  applicationUrl: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
}

/**
 * Champs manquants pour soumettre une offre. L'endroit où envoyer sa candidature (lien ou
 * email) est obligatoire ; un salaire indiqué doit préciser sa devise et sa période.
 */
export function missingSubmissionFields(offer: SubmissionFields): string[] {
  const required: (keyof SubmissionFields)[] = [
    'title',
    'companyName',
    'countryIso2',
    'categoryId',
    'contractType',
    'workMode',
    'description',
    'startDate',
    'endDate',
    'sourceType',
  ];
  const missing: string[] = required.filter((field) => !offer[field]?.toString().trim());
  if (!offer.applicationEmail && !offer.applicationUrl) {
    missing.push('applicationUrl');
  }
  if (offer.salaryMin || offer.salaryMax) {
    if (!offer.salaryCurrency) missing.push('salaryCurrency');
    if (!offer.salaryPeriod) missing.push('salaryPeriod');
  }
  return missing;
}

// --- Recherche et adresses publiques --------------------------------------------------------

const SEARCH_TEXT_MAX = 20_000;
const SLUG_BODY_MAX = 140;

/**
 * Texte de recherche normalisé (minuscules, sans accents ni ponctuation) : la même
 * normalisation est appliquée aux termes recherchés, ce qui rend la recherche insensible
 * aux accents (« ingenieur » trouve « Ingénieur »).
 */
export function buildSearchText(parts: readonly (string | null | undefined)[]): string | null {
  const text = toSearchName(parts.filter(Boolean).join(' '));
  return text ? text.slice(0, SEARCH_TEXT_MAX) : null;
}

/** Termes d'une recherche : normalisés, deux caractères au moins, huit au plus. */
export function searchTerms(query: string | undefined): string[] {
  if (!query) return [];
  const unique = new Set(
    toSearchName(query)
      .split(' ')
      .filter((term) => term.length >= 2),
  );
  return [...unique].slice(0, 8);
}

/**
 * Adresse publique lisible et stable : « comptable-confirme-logistique-ouest-dakar-3f9a2c1b ».
 * Le suffixe (fin aléatoire de l'identifiant UUID v7) garantit l'unicité.
 */
export function buildSlug(
  title: string,
  companyName: string,
  cityName: string | null,
  id: string,
): string {
  const body = toSearchName([title, companyName, cityName].filter(Boolean).join(' '))
    .replace(/ /g, '-')
    .slice(0, SLUG_BODY_MAX)
    .replace(/-+$/g, '');
  const suffix = id.replace(/-/g, '').slice(-8);
  return body ? `${body}-${suffix}` : suffix;
}
