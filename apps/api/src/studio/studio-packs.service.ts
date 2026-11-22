import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type CareerPackCreateInput,
  type CareerPackInfoResponse,
  type CareerPackResponse,
  ERROR_CODES,
  EXPORT_SERVICE_BY_TYPE,
  PACK_LETTER_TYPES,
  type PackLetterType,
} from '@opportinities/shared';
import { uuidv7 } from '../common/uuid-v7';
import { CreditsService } from '../finance/credits.service';
import { FinancialSettingsService } from '../finance/financial-settings.service';
import { type CareerDocumentPack, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { splitPack } from './pack-split';
import { PDF_RENDERER, type PdfRenderer } from './pdf-renderer';
import { signerName, StudioExportsService } from './studio-exports.service';

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Le débit est réparti entre deux documents : en dessous, le tarif n'est pas utilisable. */
const MIN_PACK_CREDITS = 2;

const isPackLetter = (type: string): type is PackLetterType =>
  (PACK_LETTER_TYPES as readonly string[]).includes(type);

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Pack CV + lettre (cahier des charges §11.8) : un seul débit paie l'export des deux documents.
 * Il crée un paiement par document ; les exports suivent ensuite le chemin ordinaire, avec la même
 * période de ré-export gratuit et la même garantie en cas d'échec technique.
 */
@Injectable()
export class StudioPacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly settings: FinancialSettingsService,
    private readonly exports: StudioExportsService,
    @Inject(PDF_RENDERER) private readonly renderer: PdfRenderer,
  ) {}

  async info(userId: string): Promise<CareerPackInfoResponse> {
    const [documents, account, cost, cvCost, coverCost, applicationCost, reexportWindowDays] =
      await Promise.all([
        this.prisma.careerDocument.findMany({
          where: { userId, deletedAt: null, type: { in: ['cv', ...PACK_LETTER_TYPES] } },
          orderBy: { updatedAt: 'desc' },
          select: { id: true, type: true, title: true, content: true },
        }),
        this.prisma.creditAccount.findUnique({ where: { userId }, select: { balance: true } }),
        this.packCost(this.prisma),
        this.separateCost('cv', this.prisma),
        this.separateCost('cover_letter', this.prisma),
        this.separateCost('application_letter', this.prisma),
        this.exports.windowDays(this.prisma),
      ]);
    const sum = (letter: number | null) =>
      cvCost !== null && letter !== null ? cvCost + letter : null;
    const candidates = await Promise.all(
      documents.map(async (document) => ({
        id: document.id,
        type: document.type as 'cv' | PackLetterType,
        title: document.title,
        complete: signerName(document.content).trim() !== '',
        covered: (await this.exports.coveringPass(this.prisma, document.id)) !== null,
      })),
    );
    return {
      cost,
      separateCosts: { cover_letter: sum(coverCost), application_letter: sum(applicationCost) },
      balance: account?.balance ?? 0,
      reexportWindowDays,
      documents: candidates,
    };
  }

  async create(userId: string, input: CareerPackCreateInput): Promise<CareerPackResponse> {
    const replay = await this.findByKey(userId, input.idempotencyKey);
    if (replay) return this.respond(userId, replay);
    // Aucun débit si l'impression est impossible de toute façon.
    if (!this.renderer.enabled) {
      throw new ServiceUnavailableException({ code: ERROR_CODES.SERVICE_UNAVAILABLE });
    }

    let created: CareerDocumentPack;
    try {
      created = await this.prisma.$transaction((tx) => this.charge(tx, userId, input));
    } catch (error) {
      // Double clic : la même clé a déjà payé ce pack. Le second appel peut aussi trouver les
      // documents déjà couverts par le premier, d'où la relecture pour tout refus.
      const again = await this.findByKey(userId, input.idempotencyKey);
      if (again && (isUniqueViolation(error) || error instanceof ConflictException)) {
        return this.respond(userId, again);
      }
      throw error;
    }
    return this.respond(userId, created);
  }

  private async charge(
    tx: Tx,
    userId: string,
    input: CareerPackCreateInput,
  ): Promise<CareerDocumentPack> {
    const ids = [input.cvDocumentId, input.letterDocumentId];
    // Verrous pris dans un ordre stable : deux packs croisés ne s'interbloquent pas.
    await tx.$queryRaw`
      SELECT "id" FROM "career_documents"
      WHERE "id" = ANY(${ids}::uuid[]) AND "user_id" = ${userId}::uuid AND "deleted_at" IS NULL
      ORDER BY "id" FOR UPDATE`;
    const documents = await tx.careerDocument.findMany({
      where: { id: { in: ids }, userId, deletedAt: null },
      select: { id: true, type: true, content: true },
    });
    const cv = documents.find((document) => document.id === input.cvDocumentId);
    const letter = documents.find((document) => document.id === input.letterDocumentId);
    if (!cv || !letter) {
      throw new NotFoundException({ code: ERROR_CODES.CAREER_DOCUMENT_NOT_FOUND });
    }
    if (cv.type !== 'cv' || !isPackLetter(letter.type)) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.CAREER_PACK_INVALID });
    }
    if (!signerName(cv.content).trim() || !signerName(letter.content).trim()) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.CAREER_EXPORT_INCOMPLETE });
    }
    // Un document déjà payé ne l'est jamais une seconde fois par un pack.
    for (const id of ids) {
      if (await this.exports.coveringPass(tx, id)) {
        throw new ConflictException({ code: ERROR_CODES.CAREER_PACK_ALREADY_COVERED });
      }
    }

    const cost = await this.packCost(tx);
    if (cost === null) {
      throw new ServiceUnavailableException({ code: ERROR_CODES.CAREER_EXPORT_PRICE_MISSING });
    }
    const [cvCost, letterCost, windowDays] = await Promise.all([
      this.separateCost('cv', tx),
      this.separateCost(letter.type, tx),
      this.exports.windowDays(tx),
    ]);
    const packId = uuidv7();
    const consumed = await this.credits.consume(tx, {
      userId,
      service: 'doc_pack',
      credits: cost,
      idempotencyKey: `career-pack:${userId}:${input.idempotencyKey}`,
      referenceType: 'career_document_pack',
      referenceId: packId,
    });
    const now = Date.now();
    const pack = await tx.careerDocumentPack.create({
      data: {
        id: packId,
        userId,
        idempotencyKey: input.idempotencyKey,
        credits: cost,
        movementId: consumed.movementId,
        valueUsd: consumed.valueUsd,
        createdAt: new Date(now),
      },
    });
    const shares = splitPack(cost, consumed.valueUsd, cvCost, letterCost);
    await tx.careerDocumentPass.createMany({
      data: ids.map((documentId, index) => ({
        userId,
        documentId,
        packId,
        service: 'doc_pack' as const,
        credits: shares[index]!.credits,
        valueUsd: shares[index]!.valueUsd,
        movementId: consumed.movementId,
        createdAt: new Date(now),
        validUntil: new Date(now + windowDays * DAY_MS),
      })),
    });
    return pack;
  }

  private findByKey(userId: string, idempotencyKey: string): Promise<CareerDocumentPack | null> {
    return this.prisma.careerDocumentPack.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
  }

  private async packCost(db: Tx | PrismaService): Promise<number | null> {
    const cost = await this.settings.requireCost('doc_pack', db).catch(() => null);
    return cost !== null && cost >= MIN_PACK_CREDITS ? cost : null;
  }

  private separateCost(type: 'cv' | PackLetterType, db: Tx | PrismaService) {
    return this.settings.requireCost(EXPORT_SERVICE_BY_TYPE[type], db).catch(() => null);
  }

  private async respond(userId: string, pack: CareerDocumentPack): Promise<CareerPackResponse> {
    const [account, passes] = await Promise.all([
      this.prisma.creditAccount.findUnique({ where: { userId }, select: { balance: true } }),
      this.prisma.careerDocumentPass.findMany({
        where: { packId: pack.id },
        select: { documentId: true },
      }),
    ]);
    return {
      id: pack.id,
      credits: pack.credits,
      balance: account?.balance ?? 0,
      documentIds: passes.map((pass) => pass.documentId),
    };
  }
}
