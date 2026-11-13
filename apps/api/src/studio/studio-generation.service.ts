import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AI_GENERATE_SERVICE_BY_TYPE,
  AI_IMPROVE_SERVICE,
  AI_SECTION_SERVICE,
  type AiGenerateInput,
  type AiGenerationOptions,
  type AiGenerationResponse,
  type AiGenerationResult,
  type AiImproveInput,
  type AiPricesResponse,
  type AiSectionInput,
  aiServiceFor,
  type CareerDocumentContent,
  CV_SECTION,
  ERROR_CODES,
  isLetterType,
  LETTER_SECTIONS,
} from '@opportinities/shared';
import { AI_PROVIDER, type AiProvider, AiProviderError } from '../ai/ai-provider';
import { uuidv7 } from '../common/uuid-v7';
import { type EnvironmentVariables } from '../config/env.validation';
import { CreditsService } from '../finance/credits.service';
import { FinancialSettingsService } from '../finance/financial-settings.service';
import {
  type AiGeneration,
  type AiGenerationAction,
  type CareerDocument,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPrompt, introducedFacts, parseSuggestion } from './cv-ai';
import {
  documentPrompt,
  type GenerationPrompt,
  mergeDocument,
  missingForGeneration,
  parseText,
  sectionAvailable,
  sectionMax,
  sectionPrompt,
  tidy,
} from './generation-prompts';

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Deux essais au plus par génération : une réponse écartée est retentée une fois, sans frais. */
const MAX_ATTEMPTS = 2;
/**
 * Au-delà, une génération « en cours » est considérée comme interrompue (arrêt du serveur
 * pendant l'appel) : elle est passée en échec et remboursée. Deux appels de 30 s + marge.
 */
export const STALE_GENERATION_MS = 3 * 60 * 1000;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

interface RunRequest {
  action: AiGenerationAction;
  idempotencyKey: string;
  section?: string;
  options?: AiGenerationOptions;
  improve?: Omit<AiImproveInput, 'idempotencyKey'>;
}

/** Ce que produit un essai : résultat utilisable, ou raison du rejet. */
type Attempt = { result: AiGenerationResult } | { rejection: string };

/**
 * Génération par l'IA payée en crédits (décision du 13 novembre 2026). Le tarif est lu côté
 * serveur selon le type de document et l'action ; le débit et l'enregistrement de la génération
 * sont atomiques ; un échec définitif (fournisseur, délai, réponse inutilisable, enregistrement
 * impossible, interruption) rembourse les crédits dans la même transaction que le passage en échec.
 */
@Injectable()
export class StudioGenerationService {
  private readonly logger = new Logger(StudioGenerationService.name);
  private readonly dailyLimit: number;
  private readonly priceInput: Prisma.Decimal | null;
  private readonly priceOutput: Prisma.Decimal | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly settings: FinancialSettingsService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.dailyLimit = config.get('STUDIO_AI_DAILY_LIMIT', { infer: true });
    const price = (value: string | undefined) => (value ? new Prisma.Decimal(value) : null);
    this.priceInput = price(config.get('OPENAI_PRICE_INPUT_USD_PER_MTOK', { infer: true }));
    this.priceOutput = price(config.get('OPENAI_PRICE_OUTPUT_USD_PER_MTOK', { infer: true }));
  }

  /** Tarifs applicables à ce document (affichés avant toute action payante) et solde. */
  async prices(userId: string, documentId: string): Promise<AiPricesResponse> {
    const document = await this.findDocument(userId, documentId);
    const cost = (service: Parameters<FinancialSettingsService['requireCost']>[0]) =>
      this.settings.requireCost(service).catch(() => null);
    const [generate, section, improve, balance] = await Promise.all([
      cost(AI_GENERATE_SERVICE_BY_TYPE[document.type]),
      cost(AI_SECTION_SERVICE),
      cost(AI_IMPROVE_SERVICE),
      this.balance(userId),
    ]);
    return { generate, section, improve, balance };
  }

  generate(userId: string, documentId: string, input: AiGenerateInput) {
    return this.run(userId, documentId, {
      action: 'generate',
      idempotencyKey: input.idempotencyKey,
      options: input.options,
    });
  }

  regenerateSection(userId: string, documentId: string, input: AiSectionInput) {
    return this.run(userId, documentId, {
      action: 'regenerate_section',
      idempotencyKey: input.idempotencyKey,
      section: input.section,
      options: input.options,
    });
  }

  improve(userId: string, documentId: string, input: AiImproveInput) {
    const { idempotencyKey, ...improve } = input;
    return this.run(userId, documentId, { action: 'improve', idempotencyKey, improve });
  }

  /** État d'une génération (après une réponse interrompue : vérifier avant de relancer). */
  async status(
    userId: string,
    documentId: string,
    idempotencyKey: string,
  ): Promise<AiGenerationResponse> {
    const row = await this.prisma.aiGeneration.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (!row || row.documentId !== documentId) {
      throw new NotFoundException({ code: ERROR_CODES.CAREER_DOCUMENT_NOT_FOUND });
    }
    return this.respond(await this.recoverIfStale(row));
  }

  /** Générations interrompues (arrêt du serveur pendant l'appel) : échec et remboursement. */
  async recoverStale(now = new Date()): Promise<number> {
    const stale = await this.prisma.aiGeneration.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: new Date(now.getTime() - STALE_GENERATION_MS) },
      },
      select: { id: true },
      take: 100,
    });
    for (const row of stale) await this.fail(row.id, 'interrupted');
    if (stale.length > 0)
      this.logger.warn(`${stale.length} génération(s) interrompue(s) remboursée(s).`);
    return stale.length;
  }

  private async run(
    userId: string,
    documentId: string,
    request: RunRequest,
  ): Promise<AiGenerationResponse> {
    // Même clé : même génération, jamais un second débit (double clic, réseau coupé).
    const replay = await this.findByKey(userId, request.idempotencyKey);
    if (replay) return this.replay(replay, documentId);

    const document = await this.findDocument(userId, documentId);
    this.assertRunnable(document, request);
    if (!this.provider.enabled) {
      throw new ServiceUnavailableException({ code: ERROR_CODES.AI_UNAVAILABLE });
    }
    const today = await this.prisma.aiGeneration.count({
      where: { userId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    });
    if (today >= this.dailyLimit) {
      throw new HttpException(
        { code: ERROR_CODES.AI_QUOTA_EXCEEDED, meta: { limit: this.dailyLimit } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Une génération restée bloquée sur ce document (serveur arrêté) ne doit pas l'immobiliser.
    const blocking = await this.prisma.aiGeneration.findFirst({
      where: { documentId, status: 'pending' },
    });
    if (blocking) await this.recoverIfStale(blocking);

    const service = aiServiceFor(document.type, request.action);
    const cost = await this.settings.requireCost(service).catch(() => {
      throw new ServiceUnavailableException({ code: ERROR_CODES.AI_PRICE_MISSING });
    });

    let generation: AiGeneration;
    try {
      generation = await this.prisma.$transaction(async (tx) => {
        const id = uuidv7();
        // Le solde est vérifié et débité sous verrou du compte (refus si insuffisant).
        const consumed = await this.credits.consume(tx, {
          userId,
          service,
          credits: cost,
          idempotencyKey: `ai-generation:${userId}:${request.idempotencyKey}`,
          referenceType: 'ai_generation',
          referenceId: id,
        });
        return tx.aiGeneration.create({
          data: {
            id,
            userId,
            documentId,
            documentType: document.type,
            action: request.action,
            section: request.section ?? null,
            idempotencyKey: request.idempotencyKey,
            service,
            credits: cost,
            chargeMovementId: consumed.movementId,
          },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Même clé envoyée deux fois en même temps : la seconde rejoint la première.
        const again = await this.findByKey(userId, request.idempotencyKey);
        if (again) return this.replay(again, documentId);
        // Autre génération déjà en cours sur ce document : rien n'a été débité.
        throw new ConflictException({ code: ERROR_CODES.AI_GENERATION_IN_PROGRESS });
      }
      throw error;
    }

    return this.respond(await this.execute(generation, document, request));
  }

  /** Appel au fournisseur, contrôles, puis enregistrement du résultat ou remboursement. */
  private async execute(
    generation: AiGeneration,
    document: CareerDocument,
    request: RunRequest,
  ): Promise<AiGeneration> {
    let failure = 'rejected';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      let outcome: Attempt;
      try {
        outcome = await this.attempt(generation, document, request);
      } catch (error) {
        failure = error instanceof AiProviderError ? `provider_${error.reason}` : 'internal_error';
        if (!(error instanceof AiProviderError)) {
          this.logger.error(`Génération ${generation.id} : ${(error as Error).message}`);
        }
        break;
      }
      if ('result' in outcome) {
        try {
          await this.prisma.aiGeneration.updateMany({
            where: { id: generation.id, status: 'pending' },
            data: {
              status: 'succeeded',
              result: outcome.result as unknown as Prisma.InputJsonValue,
              completedAt: new Date(),
            },
          });
          // 0 ligne : la génération a été déclarée interrompue entre-temps (déjà remboursée).
          return await this.prisma.aiGeneration.findUniqueOrThrow({ where: { id: generation.id } });
        } catch (error) {
          this.logger.error(
            `Génération ${generation.id} non enregistrée : ${(error as Error).message}`,
          );
          failure = 'save_failed';
          break;
        }
      }
      failure = outcome.rejection;
    }
    return this.fail(generation.id, failure);
  }

  /** Un appel au fournisseur, journalisé (sans texte), puis contrôlé. */
  private async attempt(
    generation: AiGeneration,
    document: CareerDocument,
    request: RunRequest,
  ): Promise<Attempt> {
    const prompt = this.prompt(document, request);
    const started = Date.now();
    let raw: string;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    try {
      const result = await this.provider.complete({
        system: prompt.system,
        user: prompt.user,
        maxOutputTokens: prompt.maxOutputTokens,
      });
      raw = result.text;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
    } catch (error) {
      await this.log(generation, started, 'failed', null, null, (error as AiProviderError).reason);
      throw error;
    }
    const outcome = this.interpret(document, request, prompt, raw);
    await this.log(
      generation,
      started,
      'result' in outcome ? 'succeeded' : 'rejected',
      inputTokens,
      outputTokens,
      'result' in outcome ? null : outcome.rejection,
    );
    return outcome;
  }

  private prompt(document: CareerDocument, request: RunRequest): GenerationPrompt {
    const language = document.language === 'en' ? 'en' : 'fr';
    if (request.action === 'generate') {
      return documentPrompt(
        document.type,
        language,
        document.content,
        document.brief,
        request.options,
      );
    }
    if (request.action === 'regenerate_section') {
      return sectionPrompt(
        document.type,
        language,
        request.section as string,
        document.content,
        document.brief,
        request.options,
      );
    }
    const improve = request.improve as NonNullable<RunRequest['improve']>;
    const built = buildPrompt({ ...improve, language });
    const source = [improve.text, improve.context?.title, improve.context?.organization]
      .filter(Boolean)
      .join('\n');
    return { ...built, source, maxOutputTokens: 2_500 };
  }

  private interpret(
    document: CareerDocument,
    request: RunRequest,
    prompt: GenerationPrompt,
    raw: string,
  ): Attempt {
    if (request.action === 'generate') {
      const merged = mergeDocument(document.type, raw, document.content, prompt.source);
      if (merged.rejection) return { rejection: merged.rejection };
      return {
        result: { kind: 'document', content: merged.content as CareerDocumentContent },
      };
    }
    if (request.action === 'regenerate_section') {
      const section = request.section as string;
      const parsed = parseText(raw, sectionMax(document.type, section), prompt.source);
      if (!parsed.text) return { rejection: parsed.rejection ?? 'invalid_format' };
      return { result: { kind: 'section', section, text: parsed.text } };
    }
    const improve = request.improve as NonNullable<RunRequest['improve']>;
    const parsed = parseSuggestion(raw, improve.target);
    const suggestion = parsed === null ? null : tidy(parsed);
    if (!suggestion) return { rejection: 'invalid_format' };
    if (introducedFacts(prompt.source, suggestion).length > 0) {
      return { rejection: 'introduced_facts' };
    }
    return { result: { kind: 'text', text: suggestion } };
  }

  /** Vérifications faites avant tout débit : rien n'est facturé pour une demande impossible. */
  private assertRunnable(document: CareerDocument, request: RunRequest): void {
    if (request.action === 'generate') {
      const missing = missingForGeneration(document.type, document.content, document.brief);
      if (missing.length > 0) {
        throw new UnprocessableEntityException({
          code: ERROR_CODES.AI_GENERATION_INCOMPLETE,
          details: missing.map((field) => ({ field, rules: ['isNotEmpty'] })),
        });
      }
    }
    if (request.action === 'regenerate_section') {
      const section = request.section ?? '';
      const valid = isLetterType(document.type)
        ? (LETTER_SECTIONS as readonly string[]).includes(section)
        : CV_SECTION.test(section);
      if (!valid || !sectionAvailable(document.type, section, document.content)) {
        throw new UnprocessableEntityException({ code: ERROR_CODES.AI_SECTION_INVALID });
      }
    }
  }

  /**
   * Échec définitif : remboursement et passage en échec dans une même transaction, sous verrou de
   * la ligne. Une génération déjà terminée n'est jamais remboursée (ni deux fois).
   */
  private async fail(generationId: string, failureCode: string): Promise<AiGeneration> {
    return this.prisma.$transaction(async (tx: Tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "ai_generations"
        WHERE "id" = ${generationId}::uuid AND "status" = 'pending' FOR UPDATE`;
      const row = await tx.aiGeneration.findUniqueOrThrow({ where: { id: generationId } });
      if (locked.length === 0) return row;
      const refund = await this.credits.refund(tx, {
        movementId: row.chargeMovementId,
        service: row.service,
        referenceType: 'ai_generation',
        referenceId: row.id,
        reason: `Génération IA échouée (${failureCode}) : remboursement automatique.`,
      });
      return tx.aiGeneration.update({
        where: { id: generationId },
        data: {
          status: 'failed',
          failureCode: failureCode.slice(0, 60),
          refundMovementId: refund.movementId,
          completedAt: new Date(),
        },
      });
    });
  }

  private async recoverIfStale(row: AiGeneration): Promise<AiGeneration> {
    if (row.status !== 'pending' || Date.now() - row.createdAt.getTime() < STALE_GENERATION_MS) {
      return row;
    }
    return this.fail(row.id, 'interrupted');
  }

  private async replay(row: AiGeneration, documentId: string): Promise<AiGenerationResponse> {
    if (row.documentId !== documentId) {
      // Une clé ne sert qu'à une seule opération, sur un seul document.
      throw new ConflictException({ code: ERROR_CODES.BAD_REQUEST });
    }
    return this.respond(await this.recoverIfStale(row));
  }

  private async respond(row: AiGeneration): Promise<AiGenerationResponse> {
    return {
      id: row.id,
      action: row.action,
      status: row.status,
      section: row.section,
      credits: row.credits,
      refunded: row.refundMovementId !== null,
      failureCode: row.status === 'failed' ? ERROR_CODES.AI_GENERATION_FAILED : null,
      result: row.status === 'succeeded' ? (row.result as unknown as AiGenerationResult) : null,
      balance: await this.balance(row.userId),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async log(
    generation: AiGeneration,
    started: number,
    status: 'succeeded' | 'rejected' | 'failed',
    inputTokens: number | null,
    outputTokens: number | null,
    errorCode: string | null,
  ): Promise<void> {
    await this.prisma.aiRequest.create({
      data: {
        userId: generation.userId,
        documentId: generation.documentId,
        generationId: generation.id,
        documentType: generation.documentType,
        feature: `studio.${generation.action}`,
        model: this.provider.model.slice(0, 80),
        status,
        inputTokens,
        outputTokens,
        estimatedCostUsd: this.estimate(inputTokens, outputTokens),
        latencyMs: Date.now() - started,
        errorCode: errorCode?.slice(0, 60) ?? null,
      },
    });
  }

  /** Coût estimé d'un appel selon les tarifs OpenAI configurés (null s'ils ne le sont pas). */
  private estimate(inputTokens: number | null, outputTokens: number | null): Prisma.Decimal | null {
    if (!this.priceInput || !this.priceOutput || inputTokens === null || outputTokens === null) {
      return null;
    }
    return this.priceInput
      .mul(inputTokens)
      .add(this.priceOutput.mul(outputTokens))
      .div(1_000_000)
      .toDecimalPlaces(8);
  }

  private async balance(userId: string): Promise<number> {
    const account = await this.prisma.creditAccount.findUnique({
      where: { userId },
      select: { balance: true },
    });
    return account?.balance ?? 0;
  }

  private findByKey(userId: string, idempotencyKey: string) {
    return this.prisma.aiGeneration.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
  }

  private async findDocument(userId: string, documentId: string): Promise<CareerDocument> {
    const document = await this.prisma.careerDocument.findFirst({
      where: { id: documentId, userId, deletedAt: null },
    });
    if (!document) throw new NotFoundException({ code: ERROR_CODES.CAREER_DOCUMENT_NOT_FOUND });
    return document;
  }
}
