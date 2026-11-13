import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type CareerExportDownloadResponse,
  type CareerExportRenderData,
  type CareerExportResponse,
  type CareerExportsResponse,
  type CareerExportSummary,
  type CareerDocumentContent,
  type CreditService,
  ERROR_CODES,
  EXPORT_SERVICE_BY_TYPE,
} from '@opportinities/shared';
import { uuidv7 } from '../common/uuid-v7';
import { type EnvironmentVariables } from '../config/env.validation';
import { CreditsService } from '../finance/credits.service';
import { FinancialSettingsService } from '../finance/financial-settings.service';
import { type CareerDocumentExport, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PDF_RENDERER, type PdfRenderer } from './pdf-renderer';
import { RenderTokenService } from './render-token';

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nom du signataire : titulaire du CV ou expéditeur de la lettre (obligatoire avant tout export). */
function signerName(content: unknown): string {
  const value = content as { personal?: { fullName?: unknown }; sender?: { fullName?: unknown } };
  const name = value.personal?.fullName ?? value.sender?.fullName;
  return typeof name === 'string' ? name : '';
}
/** Au-delà, un PDF de CV est anormal (page d'erreur imprimée, boucle de rendu). */
const MAX_PDF_BYTES = 10 * 1024 * 1024;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const toSummary = (row: CareerDocumentExport): CareerExportSummary => ({
  id: row.id,
  status: row.status,
  charged: row.charged,
  templateKey: row.templateKey,
  documentVersion: row.documentVersion,
  createdAt: row.createdAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
});

/** Nom de fichier lisible et sûr pour le téléchargement (« CV comptable 2026.pdf »). */
const fileName = (title: string): string => {
  const visible = [...title].map((char) => (char.charCodeAt(0) < 32 ? ' ' : char)).join('');
  const safe = visible
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${safe || 'document'}.pdf`;
};

/**
 * Exports PDF du Career Studio (CLAUDE.md §12) : l'aperçu et la modification sont gratuits, l'export
 * est payé en crédits. Un paiement ouvre une période de ré-exports gratuits du même document
 * (paramètre « studio_reexport_window_days ») ; un export qui échoue n'est jamais payé deux fois.
 */
@Injectable()
export class StudioExportsService {
  private readonly logger = new Logger(StudioExportsService.name);
  private readonly renderBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly settings: FinancialSettingsService,
    private readonly storage: StorageService,
    private readonly tokens: RenderTokenService,
    @Inject(PDF_RENDERER) private readonly renderer: PdfRenderer,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.renderBaseUrl = config.get('STUDIO_RENDER_BASE_URL', { infer: true }).replace(/\/$/, '');
  }

  async list(userId: string, documentId: string): Promise<CareerExportsResponse> {
    const document = await this.findDocument(userId, documentId);
    const service = EXPORT_SERVICE_BY_TYPE[document.type];
    const [exports, pass, balance, cost, windowDays] = await Promise.all([
      this.prisma.careerDocumentExport.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.coveringPass(this.prisma, documentId),
      this.prisma.creditAccount.findUnique({ where: { userId }, select: { balance: true } }),
      service ? this.settings.requireCost(service).catch(() => null) : Promise.resolve(null),
      this.windowDays(this.prisma),
    ]);
    return {
      cost,
      balance: balance?.balance ?? 0,
      coveredUntil: pass ? pass.coveredUntil.toISOString() : null,
      reexportWindowDays: windowDays,
      exports: exports.map(toSummary),
    };
  }

  async create(
    userId: string,
    documentId: string,
    idempotencyKey: string,
  ): Promise<CareerExportResponse> {
    const replay = await this.prisma.careerDocumentExport.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (replay) return this.respond(userId, replay);

    const document = await this.findDocument(userId, documentId);
    const service = EXPORT_SERVICE_BY_TYPE[document.type];
    if (!service) {
      throw new UnprocessableEntityException({
        code: ERROR_CODES.CAREER_DOCUMENT_TYPE_UNAVAILABLE,
      });
    }
    if (!signerName(document.content).trim()) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.CAREER_EXPORT_INCOMPLETE });
    }
    // Aucun débit si l'impression est impossible de toute façon.
    if (!this.renderer.enabled) {
      throw new ServiceUnavailableException({ code: ERROR_CODES.SERVICE_UNAVAILABLE });
    }

    let created: CareerDocumentExport;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        // Verrou du document : deux exports simultanés ne paient pas deux fois la même période.
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "career_documents"
          WHERE "id" = ${documentId}::uuid AND "user_id" = ${userId}::uuid AND "deleted_at" IS NULL
          FOR UPDATE`;
        if (!locked[0]) {
          throw new NotFoundException({ code: ERROR_CODES.CAREER_DOCUMENT_NOT_FOUND });
        }
        // Instantané relu sous verrou : contenu, modèle et version sont cohérents entre eux.
        const current = await tx.careerDocument.findUniqueOrThrow({ where: { id: documentId } });

        const covering = await this.coveringPass(tx, documentId);
        let passId = covering?.id;
        if (!passId)
          passId = await this.charge(tx, { userId, documentId, service, idempotencyKey });

        return tx.careerDocumentExport.create({
          data: {
            userId,
            documentId,
            passId,
            idempotencyKey,
            charged: !covering,
            templateKey: current.templateKey,
            language: current.language,
            documentVersion: current.version,
            title: current.title,
            content: current.content as Prisma.InputJsonValue,
          },
        });
      });
    } catch (error) {
      // Double clic : la même clé a déjà créé l'export, rien n'est débité une seconde fois.
      if (isUniqueViolation(error)) {
        const again = await this.prisma.careerDocumentExport.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
        });
        if (again) return this.respond(userId, again);
      }
      throw error;
    }

    const finished = await this.render(created);
    if (finished.status !== 'ready') {
      throw new ServiceUnavailableException({ code: ERROR_CODES.CAREER_EXPORT_FAILED });
    }
    return this.respond(userId, finished);
  }

  /** Lien de téléchargement signé et de courte durée (le PDF appartient à l'utilisateur). */
  async download(userId: string, exportId: string): Promise<CareerExportDownloadResponse> {
    const row = await this.prisma.careerDocumentExport.findFirst({
      where: { id: exportId, userId },
    });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.CAREER_EXPORT_NOT_FOUND });
    if (row.status !== 'ready' || !row.storageKey) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.CAREER_EXPORT_NOT_READY });
    }
    const signed = await this.storage.signedDownloadUrl(row.storageKey, fileName(row.title));
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }

  /**
   * Instantané d'un export pour la page d'impression. Réservé au jeton signé émis pour cet export ;
   * un export terminé n'est plus lisible par ce chemin.
   */
  async renderData(exportId: string, token: string): Promise<CareerExportRenderData> {
    const row = this.tokens.verify(exportId, token)
      ? await this.prisma.careerDocumentExport.findFirst({
          where: { id: exportId, status: 'pending' },
          include: { document: { select: { type: true } } },
        })
      : null;
    if (!row) throw new NotFoundException({ code: ERROR_CODES.CAREER_EXPORT_NOT_FOUND });
    return {
      templateKey: row.templateKey,
      language: row.language === 'en' ? 'en' : 'fr',
      title: row.title,
      type: row.document.type,
      content: row.content as unknown as CareerDocumentContent,
    };
  }

  /**
   * Paiement couvrant un nouvel export : période en cours, ou dernier paiement dont aucun export
   * n'a abouti (un échec technique ne fait jamais payer une seconde fois).
   */
  private async coveringPass(
    db: Tx | PrismaService,
    documentId: string,
  ): Promise<{ id: string; coveredUntil: Date } | null> {
    const latest = await db.careerDocumentPass.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, validUntil: true, exports: { where: { status: 'ready' }, take: 1 } },
    });
    if (!latest) return null;
    if (latest.validUntil > new Date() || latest.exports.length === 0) {
      return { id: latest.id, coveredUntil: latest.validUntil };
    }
    return null;
  }

  private async charge(
    tx: Tx,
    input: { userId: string; documentId: string; service: CreditService; idempotencyKey: string },
  ): Promise<string> {
    const cost = await this.settings.requireCost(input.service, tx).catch(() => {
      throw new ServiceUnavailableException({ code: ERROR_CODES.CAREER_EXPORT_PRICE_MISSING });
    });
    const windowDays = await this.windowDays(tx);
    const passId = uuidv7();
    const consumed = await this.credits.consume(tx, {
      userId: input.userId,
      service: input.service,
      credits: cost,
      idempotencyKey: `career-export:${input.userId}:${input.idempotencyKey}`,
      referenceType: 'career_document_pass',
      referenceId: passId,
    });
    const now = Date.now();
    await tx.careerDocumentPass.create({
      data: {
        id: passId,
        userId: input.userId,
        documentId: input.documentId,
        service: input.service,
        credits: cost,
        movementId: consumed.movementId,
        valueUsd: consumed.valueUsd,
        createdAt: new Date(now),
        validUntil: new Date(now + windowDays * DAY_MS),
      },
    });
    return passId;
  }

  /** Fenêtre de ré-export gratuit (0 si le paramètre n'est pas configuré : chaque export est payé). */
  private windowDays(db: Tx | PrismaService): Promise<number> {
    return this.settings
      .require('studio_reexport_window_days', db)
      .then((value) => value.toNumber())
      .catch(() => 0);
  }

  /** Impression, contrôle et dépôt du PDF dans le stockage privé. */
  private async render(row: CareerDocumentExport): Promise<CareerDocumentExport> {
    const url = `${this.renderBaseUrl}/${row.language}/print/career-exports/${row.id}?token=${encodeURIComponent(this.tokens.issue(row.id))}`;
    try {
      const pdf = await this.renderer.render(url);
      if (
        pdf.length === 0 ||
        pdf.length > MAX_PDF_BYTES ||
        pdf.subarray(0, 5).toString() !== '%PDF-'
      ) {
        throw new Error(`PDF invalide (${pdf.length} octets)`);
      }
      const storageKey = `career-exports/${row.userId}/${row.id}.pdf`;
      const digest = createHash('sha256').update(pdf).digest('base64');
      await this.storage.put(storageKey, pdf, 'application/pdf', digest);
      return await this.prisma.careerDocumentExport.update({
        where: { id: row.id },
        data: { status: 'ready', storageKey, sizeBytes: pdf.length, completedAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`Export ${row.id} : ${(error as Error).message}`);
      return this.prisma.careerDocumentExport.update({
        where: { id: row.id },
        data: { status: 'failed', failureReason: (error as Error).message.slice(0, 120) },
      });
    }
  }

  private async respond(userId: string, row: CareerDocumentExport): Promise<CareerExportResponse> {
    const [account, pass] = await Promise.all([
      this.prisma.creditAccount.findUnique({ where: { userId }, select: { balance: true } }),
      this.coveringPass(this.prisma, row.documentId),
    ]);
    return {
      ...toSummary(row),
      balance: account?.balance ?? 0,
      coveredUntil: pass ? pass.coveredUntil.toISOString() : null,
    };
  }

  private async findDocument(userId: string, documentId: string) {
    const document = await this.prisma.careerDocument.findFirst({
      where: { id: documentId, userId, deletedAt: null },
    });
    if (!document) throw new NotFoundException({ code: ERROR_CODES.CAREER_DOCUMENT_NOT_FOUND });
    return document;
  }
}
