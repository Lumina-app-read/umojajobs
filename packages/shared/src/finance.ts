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
  'studio_reexport_window_days',
  'payment_fee_rate',
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
  studio_reexport_window_days: 'days',
  payment_fee_rate: 'rate',
};

/** Services payables en crédits. */
export const CREDIT_SERVICES = [
  'unlock_standard',
  'unlock_premium',
  'doc_cv',
  'doc_cover_letter',
  'doc_application_letter',
  'doc_other_letter',
  'doc_pack',
  'ai_generate_cv',
  'ai_generate_cover_letter',
  'ai_generate_application_letter',
  'ai_generate_internship_request',
  'ai_generate_recommendation',
  'ai_generate_resignation',
  'ai_generate_follow_up',
  'ai_generate_thank_you',
  'ai_regenerate_section',
  'ai_improve_text',
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
  /** Contributeur affiché sur les documents (« Publiée par … sur Umoja Jobs »). */
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

/**
 * Portefeuille d'un contributeur (CLAUDE.md §11), en USD, montants décimaux en chaîne.
 * Les retraits (réservé, retiré) arrivent avec l'étape suivante : ils valent 0 jusque-là.
 */
export interface WalletResponse {
  currency: 'USD';
  pendingUsd: string;
  availableUsd: string;
  reservedUsd: string;
  totalEarnedUsd: string;
  totalWithdrawnUsd: string;
  /** Seuil de retrait en vigueur (null : non défini). */
  withdrawalMinUsd: string | null;
  /** Faux tant que les délais de sécurité des commissions ne sont pas fixés. */
  holdConfigured: boolean;
  commissionCount: number;
}

// --- Retraits (phase 3d) ---------------------------------------------------------------------

export const WITHDRAWAL_METHOD_TYPES = ['mobile_money', 'bank_transfer'] as const;
export type WithdrawalMethodType = (typeof WITHDRAWAL_METHOD_TYPES)[number];

export const WITHDRAWAL_STATUSES = [
  'pending',
  'under_review',
  'approved',
  'processing',
  'paid',
  'rejected',
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

/** Décisions de l'administration sur une demande de retrait. */
export const WITHDRAWAL_ACTIONS = [
  'review',
  'approve',
  'process',
  'pay',
  'fail',
  'reject',
] as const;
export type WithdrawalAction = (typeof WITHDRAWAL_ACTIONS)[number];

export const WITHDRAWAL_LIMITS = {
  providerMax: 100,
  holderMax: 150,
  accountMax: 40,
  referenceMax: 120,
  noteMin: 10,
  noteMax: 1000,
} as const;

export interface WithdrawalMethodInput {
  type: WithdrawalMethodType;
  countryIso2: string;
  /** Opérateur (Orange Money, M-Pesa…) ou banque. */
  provider: string;
  accountHolder: string;
  /** Numéro E.164 pour le Mobile Money, numéro de compte ou IBAN pour un virement. */
  accountNumber: string;
}

export interface WithdrawalMethodResponse {
  id: string;
  type: WithdrawalMethodType;
  countryIso2: string;
  provider: string;
  maskedAccount: string;
  createdAt: string;
}

export interface WithdrawalRequestInput {
  methodId: string;
  /** Montant en USD, décimal en chaîne (« 12.50 »). */
  amountUsd: string;
}

export interface WithdrawalEventResponse {
  toStatus: WithdrawalStatus;
  note: string | null;
  createdAt: string;
}

export interface WithdrawalResponse {
  id: string;
  amountUsd: string;
  status: WithdrawalStatus;
  method: WithdrawalMethodResponse;
  payoutReference: string | null;
  paidAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  events: WithdrawalEventResponse[];
}

/** Vue de l'administration : coordonnées déchiffrées et contrôle de la double validation. */
export interface AdminWithdrawalResponse extends WithdrawalResponse {
  user: { id: string; name: string; email: string };
  accountHolder: string;
  accountNumber: string;
  approvedBy: { id: string; name: string } | null;
  paidBy: { id: string; name: string } | null;
  /** Vrai si le montant atteint le seuil : l'approbateur ne peut pas marquer le versement. */
  dualApprovalRequired: boolean;
}

export interface WithdrawalDecisionInput {
  action: WithdrawalAction;
  /** Obligatoire pour « pay ». */
  payoutReference?: string;
  /** Date effective du versement (AAAA-MM-JJ), obligatoire pour « pay ». */
  paidOn?: string;
  /** Motif, obligatoire pour « reject » et « fail ». */
  note?: string;
}

// --- Recharges de crédits (phase 3c) ---------------------------------------------------------

export const CREDIT_ORDER_STATUSES = ['pending', 'paid', 'failed', 'abandoned', 'anomaly'] as const;
export type CreditOrderStatus = (typeof CREDIT_ORDER_STATUSES)[number];

/** Pack proposé à l'achat (seuls les packs actifs et reliés à un produit Chariow). */
export interface CreditPackResponse {
  id: string;
  sku: string;
  name: string;
  credits: number;
  /** Prix en USD, décimal en chaîne. */
  priceUsd: string;
}

export interface AdminCreditPackResponse extends CreditPackResponse {
  chariowProductId: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CreditPackInput {
  sku: string;
  name: string;
  credits: number;
  priceUsd: string;
  chariowProductId: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CreditCheckoutInput {
  packId: string;
  /** Téléphone E.164, exigé par Chariow ; celui du profil est utilisé s'il est absent. */
  phone?: string;
}

export interface CreditCheckoutResponse {
  reference: string;
  /** Page de paiement Chariow vers laquelle rediriger l'utilisateur. */
  checkoutUrl: string;
}

export interface CreditOrderResponse {
  reference: string;
  status: CreditOrderStatus;
  credits: number;
  priceUsd: string;
  createdAt: string;
  paidAt: string | null;
}

/**
 * Prix conseillé d'un pack pour encaisser, après les frais du prestataire de paiement, la valeur
 * des crédits vendus : valeur / (1 - taux), arrondie au cent supérieur. Exemple : 1 USD de crédits
 * avec 15 % de frais donne 1,18 USD.
 */
export function packPriceWithFees(creditsValueUsd: number, feeRate: number): number {
  if (!(feeRate >= 0 && feeRate < 1)) return creditsValueUsd;
  return Math.ceil((creditsValueUsd / (1 - feeRate)) * 100 - 1e-9) / 100;
}
