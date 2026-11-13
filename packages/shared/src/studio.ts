/**
 * Career Studio (cahier des charges §11) : documents professionnels assistés.
 * Le remplissage et l'aperçu sont gratuits ; l'export PDF est payé en crédits.
 */

export const CAREER_DOCUMENT_TYPES = [
  'cv',
  'cover_letter',
  'application_letter',
  'internship_request',
  'recommendation_draft',
  'resignation_letter',
  'follow_up_letter',
  'thank_you_letter',
] as const;
export type CareerDocumentType = (typeof CAREER_DOCUMENT_TYPES)[number];

/** Types déjà disponibles dans le Studio (les autres arrivent avec les étapes suivantes). */
export const AVAILABLE_DOCUMENT_TYPES: readonly CareerDocumentType[] = ['cv'];

/** Modèles de CV (§11.2). Les deux premiers sont disponibles dès l'étape 4a. */
export const CV_TEMPLATES = [
  'classic',
  'modern',
  'international',
  'academic',
  'graduate',
  'executive',
] as const;
export type CvTemplate = (typeof CV_TEMPLATES)[number];
export const AVAILABLE_CV_TEMPLATES: readonly CvTemplate[] = ['classic', 'modern'];

export const LANGUAGE_LEVELS = ['native', 'fluent', 'advanced', 'intermediate', 'basic'] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export const STUDIO_LIMITS = {
  titleMax: 120,
  shortText: 120,
  mediumText: 200,
  summaryMax: 1_500,
  descriptionMax: 2_000,
  itemsMax: 20,
  skillsMax: 40,
  skillMax: 60,
  documentsMax: 50,
} as const;

/** Mois au format « AAAA-MM » (dates de début et de fin). */
export const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface CvPersonal {
  fullName: string;
  /** Titre professionnel, par exemple « Comptable confirmé ». */
  headline: string;
  email: string;
  phone: string;
  city: string;
  countryIso2: string;
  address: string;
  summary: string;
}

export interface CvExperience {
  id: string;
  role: string;
  organization: string;
  location: string;
  startDate: string;
  /** Vide si `current`. */
  endDate: string;
  current: boolean;
  description: string;
}

export interface CvEducation {
  id: string;
  degree: string;
  school: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface CvLanguage {
  id: string;
  name: string;
  level: LanguageLevel;
}

export interface CvCertification {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

export interface CvProject {
  id: string;
  name: string;
  description: string;
  url: string;
}

export interface CvReference {
  id: string;
  name: string;
  role: string;
  organization: string;
  contact: string;
}

/** Contenu d'un CV (§11.1). Aucune photo imposée ; aucune donnée inventée. */
export interface CvContent {
  personal: CvPersonal;
  experiences: CvExperience[];
  education: CvEducation[];
  skills: string[];
  languages: CvLanguage[];
  certifications: CvCertification[];
  projects: CvProject[];
  references: CvReference[];
}

export interface CareerDocumentSummary {
  id: string;
  type: CareerDocumentType;
  title: string;
  language: 'fr' | 'en';
  templateKey: string;
  version: number;
  updatedAt: string;
}

export interface CareerDocumentResponse extends CareerDocumentSummary {
  content: CvContent;
  createdAt: string;
}

export interface CareerDocumentCreateInput {
  type: CareerDocumentType;
  title: string;
  language: 'fr' | 'en';
}

export interface CareerDocumentUpdateInput {
  /** Version lue : une écriture concurrente est refusée. */
  version: number;
  title?: string;
  language?: 'fr' | 'en';
  templateKey?: string;
  content?: CvContent;
}

/** CV vide, prérempli avec les informations connues du compte. */
export function emptyCv(personal: Partial<CvPersonal> = {}): CvContent {
  return {
    personal: {
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      city: '',
      countryIso2: '',
      address: '',
      summary: '',
      ...personal,
    },
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    references: [],
  };
}

/** Textes que l'assistant IA peut reformuler (jamais compléter). */
export const AI_IMPROVE_TARGETS = ['summary', 'experience', 'education', 'project'] as const;
export type AiImproveTarget = (typeof AI_IMPROVE_TARGETS)[number];

export const AI_LIMITS = {
  /** Texte minimal à reformuler : en dessous, l'IA n'aurait que des faits à inventer. */
  textMin: 20,
  contextMax: 120,
} as const;

export interface AiImproveInput {
  target: AiImproveTarget;
  /** Texte saisi (éventuellement pas encore enregistré). */
  text: string;
  /** Contexte facultatif : poste, employeur ou diplôme concerné. */
  context?: { title?: string; organization?: string };
}

export interface AiSuggestionResponse {
  suggestion: string;
  /** Suggestions encore disponibles aujourd'hui. */
  remaining: number;
}
