import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AiImproveInput, type AiSuggestionResponse, ERROR_CODES } from '@opportinities/shared';
import { AI_PROVIDER, type AiProvider, AiProviderError } from '../ai/ai-provider';
import { type EnvironmentVariables } from '../config/env.validation';
import { type AiRequestStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPrompt, introducedFacts, parseSuggestion, TARGET_MAX } from './cv-ai';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Une seconde tentative si la première suggestion est écartée (format ou faits ajoutés). */
const MAX_ATTEMPTS = 2;

/**
 * Assistant IA du Career Studio : reformule un texte saisi par l'utilisateur, sans rien y ajouter.
 * La suggestion n'est jamais appliquée d'office ; l'utilisateur la remplace ou l'ignore.
 * Chaque appel est journalisé (sans le texte) et compte dans un quota glissant de 24 heures.
 */
@Injectable()
export class StudioAiService {
  private readonly dailyLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.dailyLimit = config.get('STUDIO_AI_DAILY_LIMIT', { infer: true });
  }

  async improve(
    userId: string,
    documentId: string,
    input: AiImproveInput,
  ): Promise<AiSuggestionResponse> {
    const document = await this.prisma.careerDocument.findFirst({
      where: { id: documentId, userId, deletedAt: null },
      select: { id: true, language: true },
    });
    if (!document) throw new NotFoundException({ code: ERROR_CODES.CAREER_DOCUMENT_NOT_FOUND });
    if (!this.provider.enabled || this.dailyLimit === 0) {
      throw new ServiceUnavailableException({ code: ERROR_CODES.AI_UNAVAILABLE });
    }

    const used = await this.usedToday(userId);
    if (used >= this.dailyLimit) {
      throw new HttpException(
        { code: ERROR_CODES.AI_QUOTA_EXCEEDED, meta: { limit: this.dailyLimit } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const language = document.language === 'en' ? 'en' : 'fr';
    const prompt = buildPrompt({ ...input, language });
    const source = [input.text, input.context?.title, input.context?.organization]
      .filter(Boolean)
      .join('\n');
    const maxOutputTokens = Math.ceil(TARGET_MAX[input.target] / 2) + 200;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const started = Date.now();
      try {
        const result = await this.provider.complete({ ...prompt, maxOutputTokens });
        const suggestion = parseSuggestion(result.text, input.target);
        const unsafe = suggestion === null || introducedFacts(source, suggestion).length > 0;
        await this.log(userId, document.id, unsafe ? 'rejected' : 'succeeded', started, {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          errorCode: suggestion === null ? 'invalid_format' : unsafe ? 'introduced_facts' : null,
        });
        if (!unsafe && suggestion !== null) {
          return { suggestion, remaining: Math.max(0, this.dailyLimit - (used + attempt)) };
        }
      } catch (error) {
        if (!(error instanceof AiProviderError)) throw error;
        await this.log(userId, document.id, 'failed', started, { errorCode: error.reason });
        throw new ServiceUnavailableException({ code: ERROR_CODES.AI_UNAVAILABLE });
      }
    }
    throw new UnprocessableEntityException({ code: ERROR_CODES.AI_SUGGESTION_REJECTED });
  }

  private usedToday(userId: string): Promise<number> {
    return this.prisma.aiRequest.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    });
  }

  private async log(
    userId: string,
    documentId: string,
    status: AiRequestStatus,
    started: number,
    details: {
      inputTokens?: number | null;
      outputTokens?: number | null;
      errorCode?: string | null;
    },
  ): Promise<void> {
    await this.prisma.aiRequest.create({
      data: {
        userId,
        documentId,
        feature: 'studio.improve',
        model: this.provider.model.slice(0, 80),
        status,
        inputTokens: details.inputTokens ?? null,
        outputTokens: details.outputTokens ?? null,
        latencyMs: Date.now() - started,
        errorCode: details.errorCode ?? null,
      },
    });
  }
}
