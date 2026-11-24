/** Journal d'audit des actions d'administration (CLAUDE.md §16). */
export const AUDIT_RESULTS = ['success', 'denied', 'rejected', 'error'] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
  actorRoles: string[];
  method: string;
  /** Modèle de route (ex. « /admin/users/:id/suspend »), sans paramètres de recherche. */
  route: string;
  targetId: string | null;
  statusCode: number;
  result: AuditResult;
  ip: string | null;
  userAgent: string | null;
  requestId: string;
  /** Données envoyées, sans aucun secret (mots de passe, codes, coordonnées de versement masqués). */
  input: unknown;
  /** Valeurs avant et après, pour les modifications qui les fournissent. */
  changes: { type: string; before: unknown; after: unknown }[];
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  /** Identifiant à passer en `before` pour la page suivante, ou null. */
  next: string | null;
}

export const AUDIT_PAGE_SIZE = 50;
