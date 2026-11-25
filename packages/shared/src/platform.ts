/**
 * État de la plateforme (administration, lecture seule). Aucun secret n'est renvoyé : seulement
 * « configuré ou non », la joignabilité des services et le fonctionnement des tâches planifiées.
 */
/** up/down : service interrogé ; configured : réglé mais non interrogé (prestataire externe). */
export type ServiceState = 'up' | 'down' | 'configured' | 'not_configured';

export interface PlatformService {
  key: 'database' | 'redis' | 'storage' | 'mail' | 'payments' | 'ai' | 'pdf';
  state: ServiceState;
  /** Temps de réponse mesuré (ms), pour les services interrogés. */
  latencyMs: number | null;
  /** Détail non sensible : modèle d'IA, serveur d'envoi sans identifiants, etc. */
  detail: string | null;
}

export interface PlatformTask {
  key: 'job-offers' | 'notifications' | 'payments' | 'studio';
  /** Intervalle prévu entre deux exécutions (ms), null si la tâche n'est pas planifiée. */
  everyMs: number | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  completed: number;
  failed: number;
}

export interface PlatformStatus {
  generatedAt: string;
  environment: string;
  version: string;
  nodeVersion: string;
  uptimeSeconds: number;
  scheduledTasksEnabled: boolean;
  services: PlatformService[];
  tasks: PlatformTask[];
  migrations: { count: number; latest: string | null; appliedAt: string | null };
}
