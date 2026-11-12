import { type CvContent, type LanguageLevel } from '@opportinities/shared';

/** Libellés imprimés sur le CV, dans la langue du document (pas celle de l'interface). */
export interface CvLabels {
  summary: string;
  experiences: string;
  education: string;
  skills: string;
  languages: string;
  certifications: string;
  projects: string;
  references: string;
  present: string;
  contact: string;
  levels: Record<LanguageLevel, string>;
  months: Record<string, string>;
}

/** Données transmises à un modèle de CV : contenu, libellés et nom du pays déjà résolu. */
export interface CvTemplateProps {
  content: CvContent;
  labels: CvLabels;
  countryName: string;
}

/** « 2024-03 » devient « mars 2024 » ; une valeur incomplète est affichée telle quelle. */
export function formatMonth(value: string, labels: CvLabels): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = labels.months[match[2] as string];
  return month ? `${month} ${match[1]}` : value;
}

/** Période d'une expérience ou d'une formation (« mars 2021 - Aujourd'hui »). */
export function formatPeriod(
  start: string,
  end: string,
  current: boolean,
  labels: CvLabels,
): string {
  const from = start ? formatMonth(start, labels) : '';
  const to = current ? labels.present : end ? formatMonth(end, labels) : '';
  if (from && to) return `${from} - ${to}`;
  return from || to;
}

/** Ville et pays, sans séparateur orphelin. */
export function formatPlace(city: string, countryName: string): string {
  return [city, countryName].filter(Boolean).join(', ');
}

/** Paragraphes d'un texte libre : une ligne commençant par « - » ou « • » devient une puce. */
export function splitDescription(text: string): { bullets: string[]; paragraphs: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines
    .filter((line) => /^[-•*]\s*/.test(line))
    .map((line) => line.replace(/^[-•*]\s*/, ''));
  const paragraphs = lines.filter((line) => !/^[-•*]\s*/.test(line));
  return { bullets, paragraphs };
}

/** Le CV contient-il autre chose que les informations reprises du compte ? */
export function hasBody(content: CvContent): boolean {
  return (
    Boolean(content.personal.summary || content.personal.headline) ||
    content.experiences.length > 0 ||
    content.education.length > 0 ||
    content.skills.length > 0 ||
    content.languages.length > 0 ||
    content.certifications.length > 0 ||
    content.projects.length > 0 ||
    content.references.length > 0
  );
}
