import { type CvContent, YEAR_MONTH } from '@opportinities/shared';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ().-]{6,25}$/;
const URL = /^https?:\/\/\S+$/i;

export type CvIssue = 'month' | 'email' | 'url' | 'phone';

/**
 * Contrôles locaux, alignés sur ceux de l'API : tant qu'un champ est mal formé, l'enregistrement
 * automatique attend (l'API refuserait tout le document).
 */
export function validateCv(content: CvContent): Record<string, CvIssue> {
  const issues: Record<string, CvIssue> = {};
  const month = (value: string, path: string) => {
    if (value && !YEAR_MONTH.test(value)) issues[path] = 'month';
  };
  const { personal } = content;
  if (personal.email && !EMAIL.test(personal.email)) issues['personal.email'] = 'email';
  if (personal.phone && !PHONE.test(personal.phone)) issues['personal.phone'] = 'phone';
  content.experiences.forEach((item, index) => {
    month(item.startDate, `experiences.${index}.startDate`);
    if (!item.current) month(item.endDate, `experiences.${index}.endDate`);
  });
  content.education.forEach((item, index) => {
    month(item.startDate, `education.${index}.startDate`);
    month(item.endDate, `education.${index}.endDate`);
  });
  content.certifications.forEach((item, index) => month(item.date, `certifications.${index}.date`));
  content.projects.forEach((item, index) => {
    if (item.url && !URL.test(item.url)) issues[`projects.${index}.url`] = 'url';
  });
  return issues;
}
