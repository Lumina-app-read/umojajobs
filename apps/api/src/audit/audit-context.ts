import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuditChange {
  type: string;
  before: unknown;
  after: unknown;
}

interface AuditStore {
  changes: AuditChange[];
}

/** Contexte d'une requête d'administration : les valeurs avant et après de ses modifications. */
export const auditContext = new AsyncLocalStorage<AuditStore>();

/** Ajoute une modification au journal de la requête en cours (sans effet hors administration). */
export function recordAuditChange(change: AuditChange): void {
  auditContext.getStore()?.changes.push(change);
}
