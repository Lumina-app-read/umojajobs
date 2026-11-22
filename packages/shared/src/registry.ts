import { type CommissionStatus, type CreditOrderStatus } from './finance';

/** Registres financiers de l'administration : consultation seule, montants en USD (texte décimal). */
export const REGISTRY_PAGE_SIZE = 25;

/** Dernière page consultable : au-delà, une recherche plus précise est préférable. */
export const REGISTRY_MAX_PAGE = 1000;

export interface RegistryPerson {
  id: string;
  name: string;
  email: string;
}

export interface RegistryPage<Item, Summary> {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
  /** Totaux de tout le registre, indépendants de la recherche et de l'état affiché. */
  summary: Summary;
}

export interface PaymentRegistryItem {
  id: string;
  reference: string;
  buyer: RegistryPerson;
  packName: string;
  credits: number;
  priceUsd: string;
  status: CreditOrderStatus;
  failureReason: string | null;
  providerSaleId: string | null;
  createdAt: string;
  paidAt: string | null;
  /** Règlement de Chariow, null tant qu'il n'est pas connu. */
  settlement: { netUsd: string; feesUsd: string; doneAt: string | null } | null;
}

export interface PaymentRegistrySummary {
  paidOrders: number;
  grossUsd: string;
  /** Montant net des ventes déjà réglées par Chariow. */
  settledNetUsd: string;
  /** Écart entre encaissé et net sur les ventes réglées : coût réel de Chariow. */
  settledFeesUsd: string;
  /** Montant brut des ventes payées que Chariow n'a pas encore réglées. */
  awaitingUsd: string;
  anomalies: number;
}

export interface UnlockRegistryItem {
  id: string;
  candidate: RegistryPerson;
  offer: { id: string; title: string; companyName: string | null };
  credits: number;
  valueUsd: string;
  /** Commission née de ce déverrouillage, null s'il n'en ouvre pas. */
  commission: { amountUsd: string; status: CommissionStatus } | null;
  createdAt: string;
}

export interface UnlockRegistrySummary {
  unlocks: number;
  credits: number;
  valueUsd: string;
  withCommission: number;
}

export interface CommissionRegistryItem {
  id: string;
  contributor: RegistryPerson;
  offer: { id: string; title: string; companyName: string | null };
  baseValueUsd: string;
  rate: string;
  amountUsd: string;
  status: CommissionStatus;
  createdAt: string;
  availableAt: string | null;
  reversedAt: string | null;
}

export type CommissionRegistrySummary = Record<
  CommissionStatus,
  { count: number; amountUsd: string }
>;

export type PaymentRegistryResponse = RegistryPage<PaymentRegistryItem, PaymentRegistrySummary>;
export type UnlockRegistryResponse = RegistryPage<UnlockRegistryItem, UnlockRegistrySummary>;
export type CommissionRegistryResponse = RegistryPage<
  CommissionRegistryItem,
  CommissionRegistrySummary
>;
