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
  interestsMax: 15,
  interestMax: 60,
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
  /** Centres d'intérêt, facultatifs. */
  interests: string[];
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
  /** Informations factuelles fournies pour la génération par l'IA. */
  brief: CareerDocumentBrief;
  /** Photo du CV (stockage privé) ; `version` change à chaque remplacement. */
  photo: { version: string } | null;
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
  brief?: CareerDocumentBrief;
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
    interests: [],
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
  /** Identifiant aléatoire de l'opération : un double clic ne débite qu'une fois. */
  idempotencyKey: string;
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
  /** Photo du CV en data URI (instantané de l'export), ou null. */
  photo: string | null;
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

/* ------------------------------------------------------------------------------------------ */
/* Génération par l'IA, payée en crédits (décision du propriétaire du 13 novembre 2026)        */
/* ------------------------------------------------------------------------------------------ */

export const AI_GENERATION_ACTIONS = ['generate', 'regenerate_section', 'improve'] as const;
export type AiGenerationAction = (typeof AI_GENERATION_ACTIONS)[number];

export const AI_GENERATION_STATUSES = ['pending', 'succeeded', 'failed'] as const;
export type AiGenerationStatus = (typeof AI_GENERATION_STATUSES)[number];

/** Service facturé pour la génération complète de chaque type de document. */
export const AI_GENERATE_SERVICE_BY_TYPE: Record<CareerDocumentType, CreditService> = {
  cv: 'ai_generate_cv',
  cover_letter: 'ai_generate_cover_letter',
  application_letter: 'ai_generate_application_letter',
  internship_request: 'ai_generate_internship_request',
  recommendation_draft: 'ai_generate_recommendation',
  resignation_letter: 'ai_generate_resignation',
  follow_up_letter: 'ai_generate_follow_up',
  thank_you_letter: 'ai_generate_thank_you',
};
export const AI_SECTION_SERVICE: CreditService = 'ai_regenerate_section';
export const AI_IMPROVE_SERVICE: CreditService = 'ai_improve_text';

/** Service facturé pour une action donnée : déterminé par le serveur, jamais par le navigateur. */
export function aiServiceFor(type: CareerDocumentType, action: AiGenerationAction): CreditService {
  if (action === 'generate') return AI_GENERATE_SERVICE_BY_TYPE[type];
  return action === 'regenerate_section' ? AI_SECTION_SERVICE : AI_IMPROVE_SERVICE;
}

export const AI_TONES = ['formal', 'dynamic', 'sober'] as const;
export type AiTone = (typeof AI_TONES)[number];
export const AI_LENGTHS = ['short', 'standard', 'detailed'] as const;
export type AiLength = (typeof AI_LENGTHS)[number];

export interface AiGenerationOptions {
  tone?: AiTone;
  length?: AiLength;
}

/**
 * Sections régénérables : « summary », « experience:<id> », « education:<id> », « project:<id> »
 * pour un CV ; « subject », « body », « closing » pour une lettre.
 */
export const LETTER_SECTIONS = ['subject', 'body', 'closing'] as const;
export type LetterSection = (typeof LETTER_SECTIONS)[number];
export const CV_SECTION = /^(summary|(experience|education|project):[A-Za-z0-9_-]{1,40})$/;

export interface AiGenerateInput {
  idempotencyKey: string;
  options?: AiGenerationOptions;
}

export interface AiSectionInput extends AiGenerateInput {
  section: string;
}

/** Résultat d'une génération : contenu complet, section seule, ou texte amélioré. */
export type AiGenerationResult =
  | { kind: 'document'; content: CareerDocumentContent }
  | { kind: 'section'; section: string; text: string }
  | { kind: 'text'; text: string };

export interface AiGenerationResponse {
  id: string;
  action: AiGenerationAction;
  status: AiGenerationStatus;
  section: string | null;
  /** Crédits débités pour cette génération (remboursés si elle a échoué). */
  credits: number;
  refunded: boolean;
  /** Code d'erreur traduisible si la génération a échoué. */
  failureCode: string | null;
  result: AiGenerationResult | null;
  balance: number;
  createdAt: string;
}

/** Tarifs de l'IA pour un document, déterminés par le serveur, avec le solde de l'utilisateur. */
export interface AiPricesResponse {
  generate: number | null;
  section: number | null;
  improve: number | null;
  balance: number;
}

/* Informations de départ (« brief ») : faits fournis par l'utilisateur, jamais inventés. */

export const BRIEF_LIMITS = { short: 160, long: 1_500, offer: 6_000 } as const;

export interface CvBrief {
  /** Poste visé (adapte le profil et l'ordre des compétences). */
  targetRole: string;
  /** Texte d'une offre d'emploi, facultatif. */
  jobOffer: string;
}

/** Champs des informations de départ d'une lettre ; chaque type n'en utilise qu'une partie. */
export const LETTER_BRIEF_FIELDS = [
  'jobTitle',
  'offerText',
  'currentPosition',
  'experience',
  'skills',
  'motivation',
  'strengths',
  'availability',
  'school',
  'studyField',
  'studyLevel',
  'internshipDomain',
  'internshipDuration',
  'internshipGoals',
  'position',
  'startDate',
  'lastDay',
  'notice',
  'reason',
  'candidateName',
  'recommenderName',
  'recommenderRole',
  'relationship',
  'qualities',
  'purpose',
  'initialSubject',
  'initialDate',
  'context',
] as const;
export type LetterBriefField = (typeof LETTER_BRIEF_FIELDS)[number];
export type LetterBrief = Partial<Record<LetterBriefField, string>>;

/** Champs longs (texte libre) ; les autres sont courts. */
export const LETTER_BRIEF_LONG_FIELDS: readonly LetterBriefField[] = [
  'experience',
  'skills',
  'motivation',
  'strengths',
  'internshipGoals',
  'reason',
  'relationship',
  'qualities',
  'context',
];

/** Champs utiles à chaque type de lettre (questionnaire et consignes de l'IA). */
export const LETTER_BRIEF_BY_TYPE: Record<LetterType, readonly LetterBriefField[]> = {
  cover_letter: [
    'jobTitle',
    'offerText',
    'currentPosition',
    'experience',
    'skills',
    'motivation',
    'strengths',
    'availability',
  ],
  application_letter: [
    'jobTitle',
    'currentPosition',
    'experience',
    'skills',
    'motivation',
    'availability',
  ],
  internship_request: [
    'school',
    'studyField',
    'studyLevel',
    'internshipDomain',
    'internshipDuration',
    'internshipGoals',
    'skills',
    'availability',
  ],
  // Le recommandant est l'expéditeur de la lettre (bloc « expéditeur ») : son nom n'est pas redemandé.
  recommendation_draft: [
    'candidateName',
    'recommenderRole',
    'relationship',
    'qualities',
    'experience',
    'purpose',
  ],
  resignation_letter: ['position', 'startDate', 'lastDay', 'notice', 'reason'],
  follow_up_letter: ['jobTitle', 'initialSubject', 'initialDate', 'context'],
  thank_you_letter: ['jobTitle', 'context', 'reason'],
};

export type CareerDocumentBrief = CvBrief | LetterBrief;

/** Statistiques d'usage de l'IA pour l'administration : agrégats seulement, aucun texte. */
export interface AiUsageResponse {
  since: string;
  generations: {
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
  };
  credits: {
    /** Crédits débités, remboursements compris. */
    charged: number;
    refunded: number;
    net: number;
    /** Valeur interne des crédits nets consommés (recette), en USD. */
    revenueUsd: string;
  };
  openai: {
    requests: number;
    failedRequests: number;
    inputTokens: number;
    outputTokens: number;
    /** Coût estimé (tarifs configurés) ; null si les tarifs ne sont pas configurés. */
    estimatedCostUsd: string | null;
  };
  byDocumentType: {
    documentType: CareerDocumentType;
    generations: number;
    netCredits: number;
  }[];
  byAction: { action: AiGenerationAction; generations: number; netCredits: number }[];
}

/** Informations indispensables avant de générer une lettre (aucun débit sans elles). */
export const LETTER_REQUIRED_FIELDS: Record<LetterType, readonly LetterBriefField[]> = {
  cover_letter: ['jobTitle'],
  application_letter: ['jobTitle'],
  internship_request: ['studyField', 'internshipDomain'],
  recommendation_draft: ['candidateName', 'qualities'],
  resignation_letter: ['position', 'lastDay'],
  follow_up_letter: ['initialSubject'],
  thank_you_letter: ['context'],
};

/* Photo du CV (décision du 13 novembre 2026) : facultative, stockée en privé, jamais envoyée à
 * l'IA, affichée uniquement dans les modèles Moderne, Jeune diplômé et Cadre. */
export const CV_PHOTO_TEMPLATES: readonly CvTemplate[] = ['modern', 'graduate', 'executive'];
export const PHOTO_LIMITS = {
  /** Taille maximale du fichier envoyé. */
  maxBytes: 5 * 1024 * 1024,
  /** Côté de l'image carrée enregistrée (pixels). */
  size: 480,
  types: ['image/jpeg', 'image/png', 'image/webp'],
} as const;
