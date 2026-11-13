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
  /** Traçabilité chez le fournisseur (rapprochement avec son tableau de bord et son support). */
  trace: AiProviderTrace;
}

/** Identifiants renvoyés par le fournisseur ; jamais de contenu. */
export interface AiProviderTrace {
  /** Identifiant de la requête HTTP (en-tête x-request-id chez OpenAI). */
  requestId: string | null;
  /** Identifiant de la réponse (chatcmpl-… chez OpenAI). */
  responseId: string | null;
  /** Modèle qui a réellement répondu (peut préciser la version du modèle configuré). */
  model: string | null;
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
  constructor(
    readonly reason: string,
    /** Identifiant de la requête chez le fournisseur, s'il a répondu. */
    readonly requestId: string | null = null,
  ) {
    super(reason);
    this.name = 'AiProviderError';
  }
}
