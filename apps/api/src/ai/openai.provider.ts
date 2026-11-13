import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type EnvironmentVariables } from '../config/env.validation';
import {
  type AiCompletionRequest,
  type AiCompletionResult,
  type AiProvider,
  AiProviderError,
} from './ai-provider';

interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Fournisseur OpenAI, limité à l'API documentée Chat Completions (POST /v1/chat/completions)
 * avec une sortie JSON imposée. Authentification Bearer ; la clé et les textes envoyés ne sont
 * jamais journalisés.
 */
@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;
  readonly model: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.baseUrl = config.get('OPENAI_API_BASE_URL', { infer: true }).replace(/\/$/, '');
    this.apiKey = config.get('OPENAI_API_KEY', { infer: true }) || undefined;
    this.model = config.get('OPENAI_MODEL', { infer: true }) || '';
    this.timeoutMs = config.get('OPENAI_TIMEOUT_MS', { infer: true });
  }

  get enabled(): boolean {
    return Boolean(this.apiKey && this.model);
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    if (!this.enabled) throw new AiProviderError('not_configured');
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          response_format: { type: 'json_object' },
          max_completion_tokens: request.maxOutputTokens,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const name = (error as Error).name;
      this.logger.warn(`OpenAI injoignable : ${name}`);
      throw new AiProviderError(name === 'TimeoutError' ? 'timeout' : 'network');
    }
    // Identifiant de la requête chez OpenAI : à communiquer à leur support pour tout litige.
    const requestId = response.headers.get('x-request-id')?.slice(0, 100) ?? null;
    if (!response.ok) {
      // Seuls le statut et l'identifiant sont journalisés : le corps peut reprendre le texte saisi.
      this.logger.warn(
        `OpenAI : HTTP ${response.status} (requête ${requestId ?? 'sans identifiant'})`,
      );
      throw new AiProviderError(`http_${response.status}`, requestId);
    }
    const body = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
    const text = body?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.length === 0) {
      throw new AiProviderError('empty_response', requestId);
    }
    return {
      text,
      inputTokens: body?.usage?.prompt_tokens ?? null,
      outputTokens: body?.usage?.completion_tokens ?? null,
      trace: {
        requestId,
        responseId: typeof body?.id === 'string' ? body.id.slice(0, 100) : null,
        model: typeof body?.model === 'string' ? body.model.slice(0, 80) : null,
      },
    };
  }
}
