import { type CareerExportStatus } from './studio';

/** Limites d'un dossier rassemblé (CV, diplômes, pièce d'identité… réunis en un seul PDF). */
export const BUNDLE_LIMITS = {
  titleMax: 120,
  bundlesMax: 5,
  /** En dessous, il n'y a rien à rassembler. */
  filesMin: 2,
  filesMax: 20,
  fileMaxBytes: 10 * 1024 * 1024,
  totalMaxBytes: 40 * 1024 * 1024,
  pagesMax: 100,
} as const;

export type BundleFileKind = 'pdf' | 'image';

export interface BundleFileResponse {
  id: string;
  kind: BundleFileKind;
  originalName: string;
  sizeBytes: number;
  pageCount: number;
}

export interface BundleExportSummary {
  id: string;
  status: CareerExportStatus;
  /** Vrai si cet export a déclenché le paiement ; faux pour un ré-export couvert. */
  charged: boolean;
  sizeBytes: number | null;
  pageCount: number | null;
  createdAt: string;
}

export interface BundleSummary {
  id: string;
  title: string;
  fileCount: number;
  pageCount: number;
  updatedAt: string;
}

export interface BundleResponse {
  id: string;
  title: string;
  updatedAt: string;
  /** Fichiers dans l'ordre du PDF final. */
  files: BundleFileResponse[];
  exports: BundleExportSummary[];
  /** Coût en crédits d'un export payant (null si le tarif n'est pas configuré). */
  cost: number | null;
  balance: number;
  /** Fin de la période de ré-export gratuit, ou null si le prochain export est payant. */
  coveredUntil: string | null;
  reexportWindowDays: number;
}

export interface BundleCreateInput {
  title: string;
}

export interface BundleUpdateInput {
  title?: string;
  /** Identifiants de tous les fichiers, dans le nouvel ordre. */
  fileIds?: string[];
}

export interface BundleExportResponse {
  id: string;
  status: CareerExportStatus;
  bundle: BundleResponse;
}
