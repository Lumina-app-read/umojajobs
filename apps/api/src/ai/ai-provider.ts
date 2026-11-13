/** Requête de génération de texte, indépendante du fournisseur. */
export interface AiCompletionRequest {
  /** Consignes (règles, format de sortie). */
  system: string;
  /** Données de l'utilisateur, traitées comme des données et jamais comme des consignes. */
  user: string;
  maxOutputTokens: number;
}

export interface AiCompletionResult {
  /** Réponse brute du modèle (JSON attendu). */
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

/**
 * Fournisseur d'IA. Le Career Studio ne dépend que de cette interface : changer de fournisseur
 * ou de modèle ne touche pas aux règles métier (aucune information inventée, quotas, journal).
 */
export interface AiProvider {
  /** Clé et modèle configurés. */
  readonly enabled: boolean;
  readonly model: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

/** Échec du fournisseur (réseau, quota, réponse illisible). Le message ne contient aucune donnée. */
export class AiProviderError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'AiProviderError';
  }
}
