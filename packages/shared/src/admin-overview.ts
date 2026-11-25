/**
 * Tableau de bord de l'administration. Chaque bloc n'est rempli que si l'administrateur a la
 * permission correspondante (null sinon) : rien n'est calculé ni envoyé au-delà de ses droits.
 * Montants en USD, texte décimal.
 */

/** Fenêtre des indicateurs et des courbes, en jours (comparée à la fenêtre précédente). */
export const ADMIN_OVERVIEW_DAYS = 30;

export interface AdminOverviewUsers {
  total: number;
  active: number;
  suspended: number;
  verified: number;
  newInPeriod: number;
  newPreviousPeriod: number;
}

export interface AdminOverviewJobs {
  pendingReview: number;
  needsCorrection: number;
  active: number;
  /** Offres actives dont la date limite tombe dans les 7 prochains jours. */
  expiringSoon: number;
  publishedInPeriod: number;
  publishedPreviousPeriod: number;
}

export interface AdminOverviewFinance {
  revenueUsd: string;
  revenuePreviousUsd: string;
  paidOrders: number;
  /** Paiements reçus mais incohérents, en attente de revue manuelle. */
  anomalies: number;
  unlocks: number;
  unlocksPrevious: number;
  commissionsPendingUsd: string;
  commissionsAvailableUsd: string;
  /** Demandes de retrait non terminées (ni payées ni rejetées). */
  withdrawalsOpen: number;
  withdrawalsOpenUsd: string;
  aiRequests: number;
  aiCostUsd: string;
}

export interface AdminOverviewSecurity {
  loginFailed24h: number;
  accountsLocked7d: number;
  mfaFailed24h: number;
}

export interface AdminOverviewEmails {
  failed: number;
  pending: number;
}

/** Point journalier (UTC). Une mesure vaut null si elle n'est pas autorisée. */
export interface AdminOverviewPoint {
  date: string;
  signups: number | null;
  published: number | null;
  unlocks: number | null;
  revenueUsd: string | null;
}

export interface AdminOverview {
  generatedAt: string;
  days: number;
  users: AdminOverviewUsers | null;
  jobs: AdminOverviewJobs | null;
  finance: AdminOverviewFinance | null;
  security: AdminOverviewSecurity | null;
  emails: AdminOverviewEmails | null;
  series: AdminOverviewPoint[];
}
