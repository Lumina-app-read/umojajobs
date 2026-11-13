import {
  type CvContent,
  isAfricanCountryIso2,
  LANGUAGE_LEVELS,
  type LanguageLevel,
  STUDIO_LIMITS,
  YEAR_MONTH,
} from '@opportinities/shared';
import { asObject, type ContentIssue, EMAIL, fieldReader, PHONE } from './content-fields';

export type { ContentIssue } from './content-fields';

const ID = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * Valide et normalise le contenu d'un CV reçu du navigateur : seuls les champs connus sont
 * conservés, les textes sont nettoyés, les longueurs et formats contrôlés. Rien n'est inventé :
 * un champ absent devient une chaîne vide.
 */
export function normalizeCv(input: unknown): { content: CvContent; issues: ContentIssue[] } {
  const issues: ContentIssue[] = [];
  const root = asObject(input);

  const { text, pattern } = fieldReader(issues);
  const list = <T>(
    value: unknown,
    field: string,
    max: number,
    map: (item: unknown, path: string) => T,
  ): T[] => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      issues.push({ field, rule: 'isArray' });
      return [];
    }
    if (value.length > max) issues.push({ field, rule: 'arrayMaxSize' });
    return value.slice(0, max).map((item, index) => map(item, `${field}.${index}`));
  };
  const id = (value: unknown, field: string) => pattern(value, field, ID, 40);
  const month = (value: unknown, field: string) => pattern(value, field, YEAR_MONTH, 7);
  const { shortText: S, mediumText: M, descriptionMax: D } = STUDIO_LIMITS;

  const personal = asObject(root.personal);
  const country = text(personal.countryIso2, 'personal.countryIso2', 2).toUpperCase();
  if (country && !isAfricanCountryIso2(country)) {
    issues.push({ field: 'personal.countryIso2', rule: 'isIn' });
  }

  const content: CvContent = {
    personal: {
      fullName: text(personal.fullName, 'personal.fullName', S),
      headline: text(personal.headline, 'personal.headline', S),
      email: pattern(personal.email, 'personal.email', EMAIL, 254),
      phone: pattern(personal.phone, 'personal.phone', PHONE, 25),
      city: text(personal.city, 'personal.city', S),
      countryIso2: country,
      address: text(personal.address, 'personal.address', M),
      summary: text(personal.summary, 'personal.summary', STUDIO_LIMITS.summaryMax),
    },
    experiences: list(root.experiences, 'experiences', STUDIO_LIMITS.itemsMax, (item, path) => {
      const entry = asObject(item);
      const current = entry.current === true;
      return {
        id: id(entry.id, `${path}.id`),
        role: text(entry.role, `${path}.role`, S),
        organization: text(entry.organization, `${path}.organization`, S),
        location: text(entry.location, `${path}.location`, S),
        startDate: month(entry.startDate, `${path}.startDate`),
        endDate: current ? '' : month(entry.endDate, `${path}.endDate`),
        current,
        description: text(entry.description, `${path}.description`, D),
      };
    }),
    education: list(root.education, 'education', STUDIO_LIMITS.itemsMax, (item, path) => {
      const entry = asObject(item);
      return {
        id: id(entry.id, `${path}.id`),
        degree: text(entry.degree, `${path}.degree`, S),
        school: text(entry.school, `${path}.school`, S),
        location: text(entry.location, `${path}.location`, S),
        startDate: month(entry.startDate, `${path}.startDate`),
        endDate: month(entry.endDate, `${path}.endDate`),
        description: text(entry.description, `${path}.description`, D),
      };
    }),
    skills: list(root.skills, 'skills', STUDIO_LIMITS.skillsMax, (item, path) =>
      text(item, path, STUDIO_LIMITS.skillMax),
    ).filter(Boolean),
    languages: list(root.languages, 'languages', STUDIO_LIMITS.itemsMax, (item, path) => {
      const entry = asObject(item);
      const level = (LANGUAGE_LEVELS as readonly unknown[]).includes(entry.level)
        ? (entry.level as LanguageLevel)
        : 'intermediate';
      if (entry.level !== undefined && level !== entry.level) {
        issues.push({ field: `${path}.level`, rule: 'isIn' });
      }
      return { id: id(entry.id, `${path}.id`), name: text(entry.name, `${path}.name`, S), level };
    }),
    certifications: list(
      root.certifications,
      'certifications',
      STUDIO_LIMITS.itemsMax,
      (item, path) => {
        const entry = asObject(item);
        return {
          id: id(entry.id, `${path}.id`),
          name: text(entry.name, `${path}.name`, S),
          issuer: text(entry.issuer, `${path}.issuer`, S),
          date: month(entry.date, `${path}.date`),
        };
      },
    ),
    projects: list(root.projects, 'projects', STUDIO_LIMITS.itemsMax, (item, path) => {
      const entry = asObject(item);
      return {
        id: id(entry.id, `${path}.id`),
        name: text(entry.name, `${path}.name`, S),
        description: text(entry.description, `${path}.description`, D),
        url: pattern(entry.url, `${path}.url`, /^https?:\/\/\S+$/i, 300),
      };
    }),
    references: list(root.references, 'references', STUDIO_LIMITS.itemsMax, (item, path) => {
      const entry = asObject(item);
      return {
        id: id(entry.id, `${path}.id`),
        name: text(entry.name, `${path}.name`, S),
        role: text(entry.role, `${path}.role`, S),
        organization: text(entry.organization, `${path}.organization`, S),
        contact: text(entry.contact, `${path}.contact`, S),
      };
    }),
  };
  return { content, issues };
}
