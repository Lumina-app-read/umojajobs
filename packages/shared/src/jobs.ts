/**
 * Offres d'emploi : valeurs partagées entre l'API et l'interface. Alignées sur les énumérations
 * de la base (vérifié par un test de l'API).
 */

export const JOB_OFFER_STATUSES = [
  'draft',
  'pending_review',
  'needs_correction',
  'scheduled',
  'active',
  'expired',
  'rejected',
  'suspended',
  'archived',
] as const;
export type JobOfferStatus = (typeof JOB_OFFER_STATUSES)[number];

export const CONTRACT_TYPES = [
  'permanent',
  'fixed_term',
  'internship',
  'apprenticeship',
  'freelance',
  'consultancy',
  'temporary',
  'volunteer',
  'other',
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const WORK_MODES = ['on_site', 'remote', 'hybrid'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const EDUCATION_LEVELS = [
  'none',
  'secondary',
  'vocational',
  'bachelor',
  'master',
  'doctorate',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const EXPERIENCE_LEVELS = ['none', 'junior', 'intermediate', 'senior', 'expert'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const SALARY_PERIODS = ['hour', 'day', 'month', 'year'] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const JOB_SOURCE_TYPES = [
  'company_website',
  'whatsapp',
  'facebook',
  'telegram',
  'linkedin',
  'newspaper',
  'other_website',
  'other',
] as const;
export type JobSourceType = (typeof JOB_SOURCE_TYPES)[number];

/** Limites de saisie (identiques côté API et formulaire). */
export const JOB_LIMITS = {
  titleMax: 200,
  companyMax: 200,
  descriptionMax: 20_000,
  requirementsMax: 10_000,
  instructionsMax: 5_000,
  skillsMax: 20,
  skillMax: 80,
  sourceDetailsMax: 300,
  urlMax: 2048,
  addressMax: 500,
  reasonMin: 10,
  reasonMax: 2_000,
  /** Durée de validité maximale d'une offre, en jours. */
  validityMaxDays: 366,
  /** Documents complémentaires par offre (en plus de l'annonce originale). */
  attachmentsMax: 4,
} as const;

export const JOB_FILE_KINDS = ['original', 'attachment'] as const;
export type JobFileKind = (typeof JOB_FILE_KINDS)[number];

/** Statuts dans lesquels le contributeur peut encore modifier son offre. */
export const EDITABLE_JOB_STATUSES: readonly JobOfferStatus[] = ['draft', 'needs_correction'];

// --- Contrats de l'API -----------------------------------------------------------------------

/** Champs saisis par le contributeur. Tous facultatifs : un brouillon peut être incomplet. */
export interface JobOfferInput {
  title?: string | null;
  companyName?: string | null;
  countryIso2?: string | null;
  cityId?: string | null;
  categoryId?: string | null;
  contractType?: ContractType | null;
  workMode?: WorkMode | null;
  educationLevel?: EducationLevel | null;
  experienceLevel?: ExperienceLevel | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: SalaryPeriod | null;
  description?: string | null;
  requirements?: string | null;
  skills?: string[];
  contentLanguage?: 'fr' | 'en' | null;
  /** Dates calendaires « AAAA-MM-JJ », interprétées dans le fuseau de la ville ou du pays. */
  startDate?: string | null;
  endDate?: string | null;
  sourceType?: JobSourceType | null;
  sourceUrl?: string | null;
  sourceDetails?: string | null;
  applicationInstructions?: string | null;
  applicationEmail?: string | null;
  applicationUrl?: string | null;
  applicationAddress?: string | null;
}

/** Modification : la version lue est renvoyée pour détecter une écriture concurrente. */
export interface JobOfferUpdateRequest extends JobOfferInput {
  version: number;
}

export interface JobOfferSubmitRequest {
  version: number;
  /** Le contributeur certifie l'exactitude des informations et son droit de les partager. */
  declarationAccepted: boolean;
}

export interface ModerationDecisionRequest {
  version: number;
  /** Obligatoire pour un rejet, une demande de correction ou une suspension. */
  reason?: string;
}

export interface JobCategoryResponse {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
}

/** Document privé d'une offre (jamais d'URL permanente : téléchargement par lien signé). */
export interface JobOfferFileResponse {
  id: string;
  kind: JobFileKind;
  originalName: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  /** Renseigné si le contributeur a retiré le document (visible par la modération seulement). */
  deletedAt: string | null;
}

/** Lien de téléchargement signé, valable quelques secondes. */
export interface FileDownloadResponse {
  url: string;
  expiresAt: string;
}

export interface JobOfferStatusChangeResponse {
  id: string;
  fromStatus: JobOfferStatus | null;
  toStatus: JobOfferStatus;
  /** Origine du changement, sans révéler l'identité du modérateur au contributeur. */
  by: 'contributor' | 'moderator' | 'system';
  reason: string | null;
  createdAt: string;
}

export interface JobOfferSummaryResponse {
  id: string;
  status: JobOfferStatus;
  title: string | null;
  companyName: string | null;
  countryIso2: string | null;
  endDate: string | null;
  submittedAt: string | null;
  updatedAt: string;
}

export interface JobOfferResponse extends Required<Omit<JobOfferInput, 'salaryMin' | 'salaryMax'>> {
  id: string;
  status: JobOfferStatus;
  version: number;
  salaryMin: string | null;
  salaryMax: string | null;
  city: { id: string; name: string } | null;
  category: JobCategoryResponse | null;
  timezone: string | null;
  startsAt: string | null;
  endsAt: string | null;
  /** Champs encore requis pour pouvoir soumettre l'offre. */
  missingFields: string[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  expiredAt: string | null;
  history: JobOfferStatusChangeResponse[];
  files: JobOfferFileResponse[];
}

/** Vue modérateur : contributeur, doublons potentiels et historique complet. */
export interface ModerationJobOfferResponse extends JobOfferResponse {
  contributor: { id: string; firstName: string; lastName: string; email: string };
  duplicates: JobOfferSummaryResponse[];
  revisionCount: number;
}
