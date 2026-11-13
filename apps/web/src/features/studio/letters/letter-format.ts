import { type LetterContent } from '@opportinities/shared';

/** Libellés imprimés sur une lettre, dans la langue du document. */
export interface LetterLabels {
  subject: string;
  reference: string;
  enclosures: string;
  /** Gabarit « {place}, le {date} ». */
  placeDate: string;
}

export interface LetterTemplateProps {
  content: LetterContent;
  labels: LetterLabels;
  language: 'fr' | 'en';
  countryName: string;
}

/** « 2026-11-13 » devient « 13 novembre 2026 » ; sans date, celle du jour. */
export function formatLetterDate(value: string, language: 'fr' | 'en'): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date();
  return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Ligne « Dakar, le 13 novembre 2026 » (sans lieu : la date seule). */
export function placeAndDate(content: LetterContent, labels: LetterLabels, language: 'fr' | 'en') {
  const date = formatLetterDate(content.date, language);
  if (!content.place) return date;
  return labels.placeDate.replace('{place}', content.place).replace('{date}', date);
}

/** Paragraphes du corps : séparés par une ligne vide, retours à la ligne simples conservés. */
export function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function lines(text: string): string[] {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
