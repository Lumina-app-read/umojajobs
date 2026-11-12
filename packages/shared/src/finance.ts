import type { PublicJobOfferSummary } from './jobs';

/**
 * Monétisation : paramètres financiers, services payables en crédits et registre des crédits.
 * Les valeurs (taux, prix, seuils) ne sont jamais définies ici : elles sont administrables
 * et historisées côté API (CLAUDE.md §5 : aucun prix ni paramètre financier codé en dur).
 */

/** Paramètres financiers administrables (alignés sur l'énumération de la base, vérifié par test). */
export const FINANCIAL_SETTING_KEYS = [
  'credit_unit_value_usd',
  'contributor_commission_rate',
  'withdrawal_min_usd',
  'commission_hold_days',
  'commission_hold_days_new_contributor',
  'new_contributor_period_days',
  'withdrawal_dual_approval_usd',
] as const;
export type FinancialSettingKey = (typeof FINANCIAL_SETTING_KEYS)[number];

/** Unité de chaque paramètre : guide la validation et l'affichage. */
export const FINANCIAL_SETTING_UNITS: Record<FinancialSettingKey, 'usd' | 'rate' | 'days'> = {
  credit_unit_value_usd: 'usd',
  contributor_commission_rate: 'rate',
  withdrawal_min_usd: 'usd',
  commission_hold_days: 'days',
  commission_hold_days_new_contributor: 'days',
  new_contributor_period_days: 'days',
  withdrawal_dual_approval_usd: 'usd',
};

/** Services payables en crédits. */
export const CREDIT_SERVICES = [
  'unlock_standard',
  'unlock_premium',
  'doc_cv',
  'doc_cover_letter',
  'doc_application_letter',
  'doc_pack',
] as const;
export type CreditService = (typeof CREDIT_SERVICES)[number];

export const CREDIT_MOVEMENT_TYPES = [
  'purchase',
  'consume',
  'refund',
  'expire',
  'grant',
  'adjust',
] as const;
export type CreditMovementType = (typeof CREDIT_MOVEMENT_TYPES)[number];

export const FINANCE_LIMITS = {
  reasonMin: 10,
  reasonMax: 500,
  /** Plafond d'une dotation manuelle de crédits, garde-fou contre une erreur de saisie. */
  grantMaxCredits: 10_000,
  movementsPageSize: 50,
} as const;

/** Valeur en vigueur d'un paramètre (null : jamais défini, la fonction dépendante reste fermée). */
export interface FinancialSettingResponse {
  key: FinancialSettingKey;
  /** Décimal sérialisé en chaîne (jamais de nombre flottant pour un montant). */
  value: string | null;
  effectiveFrom: string | null;
  reason: string | null;
  changedBy: { id: string; name: string } | null;
}

export interface ServiceCostResponse {
  service: CreditService;
  credits: number | null;
  effectiveFrom: string | null;
  reason: string | null;
  changedBy: { id: string; name: string } | null;
}

export interface FinancialSettingInput {
  /** Décimal positif en chaîne, par exemple « 0.10 ». */
  value: string;
  reason: string;
}

export interface ServiceCostInput {
  credits: number;
  reason: string;
}

export interface CreditMovementResponse {
  id: string;
  type: CreditMovementType;
  quantity: number;
  balanceAfter: number;
  referenceType: string | null;
  reason: string | null;
  createdAt: string;
}

export interface CreditBalanceResponse {
  balance: number;
  movements: CreditMovementResponse[];
}

export interface CreditGrantInput {
  userId: string;
  credits: number;
  reason: string;
}

/** Bénéficiaire d'une dotation, retrouvé par son email (administration financière). */
export interface FinanceUserLookupResponse {
  id: string;
  name: string;
  email: string;
  balance: number;
}

export interface CreditGrantResponse {
  movementId: string;
  balance: number;
}

// --- Déverrouillages et commissions (phase 3b) ----------------------------------------------

export const COMMISSION_STATUSES = ['pending', 'available', 'paid', 'reversed'] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

/** Coût public d'un service (null : service pas encore ouvert). */
export interface CreditCostResponse {
  service: CreditService;
  credits: number | null;
}

export interface UnlockRequest {
  jobOfferId: string;
}

export interface UnlockedFile {
  id: string;
  kind: 'original' | 'attachment';
  originalName: string;
  sizeBytes: number;
}

/** Contenu révélé après déverrouillage (coordonnées et documents de candidature). */
export interface UnlockedContentsResponse {
  jobOfferId: string;
  unlockedAt: string;
  credits: number;
  applicationEmail: string | null;
  applicationUrl: string | null;
  applicationAddress: string | null;
  applicationInstructions: string | null;
  applicationPhone: string | null;
  contributorTips: string | null;
  /** Contributeur affiché sur les documents (« Publiée par … sur opportinities.com »). */
  publishedBy: string;
  files: UnlockedFile[];
}

export interface UnlockResponse {
  jobOfferId: string;
  /** Solde restant après l'opération (inchangé si l'offre était déjà déverrouillée). */
  balance: number;
  /** Faux si l'offre était déjà déverrouillée : aucun crédit n'a été débité. */
  charged: boolean;
}

/** Page d'un document, rendue côté serveur avec la mention de publication incrustée. */
export interface DocumentPagesResponse {
  fileId: string;
  pageCount: number;
}

export interface UnlockSummaryResponse {
  unlockedAt: string;
  credits: number;
  offer: PublicJobOfferSummary;
}

export interface CommissionResponse {
  id: string;
  status: CommissionStatus;
  amountUsd: string;
  rate: string;
  createdAt: string;
  availableAt: string | null;
  offer: { id: string; title: string; slug: string | null };
}
