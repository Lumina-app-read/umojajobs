import { type CreditService } from './finance';

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

/** Types disponibles dans le Studio. */
export const AVAILABLE_DOCUMENT_TYPES: readonly CareerDocumentType[] = CAREER_DOCUMENT_TYPES;

/** Lettres : tous les types sauf le CV, avec un même modèle de contenu. */
export const LETTER_TYPES = CAREER_DOCUMENT_TYPES.filter(
  (type): type is Exclude<CareerDocumentType, 'cv'> => type !== 'cv',
);
export type LetterType = (typeof LETTER_TYPES)[number];
export const isLetterType = (type: CareerDocumentType): type is LetterType => type !== 'cv';

/** Modèles de CV (§11.2). */
export const CV_TEMPLATES = [
  'classic',
  'modern',
  'international',
  'academic',
  'graduate',
  'executive',
] as const;
export type CvTemplate = (typeof CV_TEMPLATES)[number];
export const AVAILABLE_CV_TEMPLATES: readonly CvTemplate[] = CV_TEMPLATES;

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

export interface CareerDocumentResponse<
  C extends CareerDocumentContent = CareerDocumentContent,
> extends CareerDocumentSummary {
  content: C;
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
  content?: CareerDocumentContent;
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
export const AI_IMPROVE_TARGETS = [
  'summary',
  'experience',
  'education',
  'project',
  'letter',
] as const;
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

/** Service payé en crédits pour l'export PDF de chaque type de document. */
export const EXPORT_SERVICE_BY_TYPE: Record<CareerDocumentType, CreditService> = {
  cv: 'doc_cv',
  cover_letter: 'doc_cover_letter',
  application_letter: 'doc_application_letter',
  // Décision du 13 novembre 2026 : tarif distinct « Autre lettre », réglable dans l'administration.
  internship_request: 'doc_other_letter',
  recommendation_draft: 'doc_other_letter',
  resignation_letter: 'doc_other_letter',
  follow_up_letter: 'doc_other_letter',
  thank_you_letter: 'doc_other_letter',
};

export const CAREER_EXPORT_STATUSES = ['pending', 'ready', 'failed'] as const;
export type CareerExportStatus = (typeof CAREER_EXPORT_STATUSES)[number];

export interface CareerExportSummary {
  id: string;
  status: CareerExportStatus;
  /** Vrai si cet export a déclenché le paiement ; faux pour un ré-export couvert. */
  charged: boolean;
  templateKey: string;
  documentVersion: number;
  createdAt: string;
  completedAt: string | null;
}

/** Exports d'un document, avec ce qu'un nouvel export coûterait maintenant. */
export interface CareerExportsResponse {
  /** Coût en crédits d'un export payant (null si le tarif n'est pas configuré). */
  cost: number | null;
  balance: number;
  /** Fin de la période de ré-export gratuit en cours, ou null. */
  coveredUntil: string | null;
  /** Durée de ré-export gratuit ouverte par un export payé, en jours. */
  reexportWindowDays: number;
  exports: CareerExportSummary[];
}

export interface CareerExportCreateInput {
  /** Identifiant aléatoire fourni par le navigateur : un double clic ne paie pas deux fois. */
  idempotencyKey: string;
}

export interface CareerExportResponse extends CareerExportSummary {
  balance: number;
  coveredUntil: string | null;
}

export interface CareerExportDownloadResponse {
  url: string;
  expiresAt: string;
}

/** Données d'impression d'un export (route interne, protégée par un jeton signé). */
export interface CareerExportRenderData {
  type: CareerDocumentType;
  templateKey: string;
  language: 'fr' | 'en';
  title: string;
  content: CareerDocumentContent;
}

/** Modèles de lettre. */
export const LETTER_TEMPLATES = ['classic', 'modern'] as const;
export type LetterTemplate = (typeof LETTER_TEMPLATES)[number];

/** Modèles proposés pour un type de document. */
export function templatesFor(type: CareerDocumentType): readonly string[] {
  return type === 'cv' ? AVAILABLE_CV_TEMPLATES : LETTER_TEMPLATES;
}

export const LETTER_LIMITS = {
  shortText: 120,
  addressMax: 200,
  subjectMax: 200,
  salutationMax: 120,
  closingMax: 400,
  bodyMax: 5_000,
} as const;

/** Date au format « AAAA-MM-JJ ». */
export const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export interface LetterSender {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  countryIso2: string;
}

export interface LetterRecipient {
  /** Personne destinataire, si elle est connue (sinon « Madame, Monsieur »). */
  name: string;
  role: string;
  organization: string;
  address: string;
  city: string;
}

/**
 * Contenu d'une lettre (§11) : expéditeur, destinataire, lieu et date, objet, corps et formules.
 * Le même modèle sert à toutes les lettres ; seuls les exemples et formules par défaut changent.
 */
export interface LetterContent {
  sender: LetterSender;
  recipient: LetterRecipient;
  /** Ville d'écriture (« Dakar, le 13 novembre 2026 »). */
  place: string;
  date: string;
  subject: string;
  /** Référence de l'offre ou du dossier, facultative. */
  reference: string;
  salutation: string;
  /** Paragraphes séparés par une ligne vide. */
  body: string;
  closing: string;
  /** Pièces jointes, une par ligne (facultatif). */
  enclosures: string;
}

export type CareerDocumentContent = CvContent | LetterContent;

export function emptyLetter(
  sender: Partial<LetterSender>,
  defaults: { salutation: string; closing: string; subject: string; place?: string },
): LetterContent {
  return {
    sender: {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      countryIso2: '',
      ...sender,
    },
    recipient: { name: '', role: '', organization: '', address: '', city: '' },
    place: defaults.place ?? sender.city ?? '',
    date: '',
    subject: defaults.subject,
    reference: '',
    salutation: defaults.salutation,
    body: '',
    closing: defaults.closing,
    enclosures: '',
  };
}
