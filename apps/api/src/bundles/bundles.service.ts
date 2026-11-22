import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BUNDLE_LIMITS,
  type BundleExportResponse,
  type BundleResponse,
  type BundleSummary,
  type BundleUpdateInput,
  type CareerExportDownloadResponse,
  ERROR_CODES,
} from '@opportinities/shared';
import { uuidv7 } from '../common/uuid-v7';
import { CreditsService } from '../finance/credits.service';
import { FinancialSettingsService } from '../finance/financial-settings.service';
import { type DocumentBundleExport, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeDocumentImage } from '../storage/document-image';
import { inspectPdf, safeFileName } from '../storage/pdf-inspection';
import { StorageService } from '../storage/storage.service';
import { PdfAssemblyError, PdfAssemblyService } from './pdf-assembly.service';

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface UploadedBundleFile {
  buffer: Buffer;
  size: number;
  originalname: string;
}

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Dossiers rassemblés : l'utilisateur réunit les documents qu'il possède déjà (PDF et images), les
 * ordonne gratuitement, puis paie l'export en un seul PDF. Mêmes règles que les exports du Career
 * Studio : débit unique, ré-exports gratuits pendant la période réglée, aucun second débit après un
 * échec technique. Ces fichiers sont sensibles (pièces d'identité) : stockage privé, aucun envoi à
 * l'IA, effacement réel quand l'utilisateur les retire ou supprime le dossier.
 */
@Injectable()
export class BundlesService {
  private readonly logger = new Logger(BundlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly credits: CreditsService,
    private readonly settings: FinancialSettingsService,
    private readonly assembly: PdfAssemblyService,
  ) {}

  async list(userId: string): Promise<BundleSummary[]> {
    const bundles = await this.prisma.documentBundle.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: { files: { select: { pageCount: true } } },
    });
    return bundles.map((bundle) => ({
      id: bundle.id,
      title: bundle.title,
      fileCount: bundle.files.length,
      pageCount: bundle.files.reduce((sum, file) => sum + file.pageCount, 0),
      updatedAt: bundle.updatedAt.toISOString(),
    }));
  }

  async create(userId: string, title: string): Promise<BundleResponse> {
    const count = await this.prisma.documentBundle.count({ where: { userId, deletedAt: null } });
    if (count >= BUNDLE_LIMITS.bundlesMax) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.BUNDLE_LIMIT });
    }
    const bundle = await this.prisma.documentBundle.create({ data: { userId, title } });
    return this.get(userId, bundle.id);
  }

  async get(userId: string, id: string): Promise<BundleResponse> {
    const bundle = await this.prisma.documentBundle.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        files: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
        exports: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!bundle) throw new NotFoundException({ code: ERROR_CODES.BUNDLE_NOT_FOUND });
    const [account, cost, pass, reexportWindowDays] = await Promise.all([
      this.prisma.creditAccount.findUnique({ where: { userId }, select: { balance: true } }),
      this.settings.requireCost('doc_bundle').catch(() => null),
      this.coveringPass(this.prisma, id),
      this.windowDays(this.prisma),
    ]);
    return {
      id: bundle.id,
      title: bundle.title,
      updatedAt: bundle.updatedAt.toISOString(),
      files: bundle.files.map((file) => ({
        id: file.id,
        kind: file.kind,
        originalName: file.originalName,
        sizeBytes: file.sizeBytes,
        pageCount: file.pageCount,
      })),
      exports: bundle.exports.map((row) => ({
        id: row.id,
        status: row.status,
        charged: row.charged,
        sizeBytes: row.sizeBytes,
        pageCount: row.pageCount,
        createdAt: row.createdAt.toISOString(),
      })),
      cost,
      balance: account?.balance ?? 0,
      coveredUntil: pass ? pass.validUntil.toISOString() : null,
      reexportWindowDays,
    };
  }

  async update(userId: string, id: string, input: BundleUpdateInput): Promise<BundleResponse> {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId, id);
      if (input.fileIds) {
        const files = await tx.documentBundleFile.findMany({
          where: { bundleId: id },
          select: { id: true },
        });
        const wanted = new Set(input.fileIds);
        // L'ordre doit porter sur tous les fichiers actuels : sinon, la liste affichée a changé.
        if (
          wanted.size !== input.fileIds.length ||
          wanted.size !== files.length ||
          files.some((file) => !wanted.has(file.id))
        ) {
          throw new ConflictException({ code: ERROR_CODES.BUNDLE_ORDER_CONFLICT });
        }
        for (const [position, fileId] of input.fileIds.entries()) {
          await tx.documentBundleFile.update({ where: { id: fileId }, data: { position } });
        }
      }
      await tx.documentBundle.update({
        where: { id },
        data: { updatedAt: new Date(), ...(input.title !== undefined && { title: input.title }) },
      });
    });
    return this.get(userId, id);
  }

  async addFile(
    userId: string,
    id: string,
    file: UploadedBundleFile | undefined,
  ): Promise<BundleResponse> {
    await this.find(userId, id);
    if (!file || file.size === 0) {
      throw new BadRequestException({ code: ERROR_CODES.FILE_REQUIRED });
    }
    if (file.size > BUNDLE_LIMITS.fileMaxBytes) {
      throw new PayloadTooLargeException({
        code: ERROR_CODES.FILE_TOO_LARGE,
        meta: { maxMegabytes: BUNDLE_LIMITS.fileMaxBytes / 1024 / 1024 },
      });
    }
    const received = await this.receive(file.buffer);
    const extension = received.kind === 'image' ? 'jpg' : 'pdf';
    const storageKey = `document-bundles/${userId}/${id}/${uuidv7()}.${extension}`;
    await this.storage.put(
      storageKey,
      received.content,
      received.kind === 'image' ? 'image/jpeg' : 'application/pdf',
      createHash('sha256').update(received.content).digest('base64'),
    );
    try {
      await this.prisma.$transaction(async (tx) => {
        // Verrou : deux envois simultanés ne dépassent pas ensemble les limites du dossier.
        await this.lock(tx, userId, id);
        const total = await tx.documentBundleFile.aggregate({
          where: { bundleId: id },
          _count: true,
          _sum: { sizeBytes: true, pageCount: true },
          _max: { position: true },
        });
        if (
          total._count >= BUNDLE_LIMITS.filesMax ||
          (total._sum.sizeBytes ?? 0) + received.content.length > BUNDLE_LIMITS.totalMaxBytes ||
          (total._sum.pageCount ?? 0) + received.pages > BUNDLE_LIMITS.pagesMax
        ) {
          throw new UnprocessableEntityException({ code: ERROR_CODES.BUNDLE_FILES_LIMIT });
        }
        await tx.documentBundleFile.create({
          data: {
            bundleId: id,
            position: (total._max.position ?? -1) + 1,
            kind: received.kind,
            originalName: safeFileName(file.originalname, extension),
            storageKey,
            sizeBytes: received.content.length,
            pageCount: received.pages,
          },
        });
        await tx.documentBundle.update({ where: { id }, data: { updatedAt: new Date() } });
      });
    } catch (error) {
      await this.discard(storageKey);
      throw error;
    }
    return this.get(userId, id);
  }

  async removeFile(userId: string, id: string, fileId: string): Promise<BundleResponse> {
    const storageKey = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId, id);
      const file = await tx.documentBundleFile.findFirst({ where: { id: fileId, bundleId: id } });
      if (!file) throw new NotFoundException({ code: ERROR_CODES.FILE_NOT_FOUND });
      await tx.documentBundleFile.delete({ where: { id: fileId } });
      await tx.documentBundle.update({ where: { id }, data: { updatedAt: new Date() } });
      return file.storageKey;
    });
    await this.discard(storageKey);
    return this.get(userId, id);
  }

  /** Suppression du dossier : fichiers et PDF effacés du stockage, pièces comptables conservées. */
  async remove(userId: string, id: string): Promise<void> {
    const keys = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId, id);
      const [files, exports] = await Promise.all([
        tx.documentBundleFile.findMany({ where: { bundleId: id }, select: { storageKey: true } }),
        tx.documentBundleExport.findMany({
          where: { bundleId: id, storageKey: { not: null } },
          select: { storageKey: true },
        }),
      ]);
      await tx.documentBundleFile.deleteMany({ where: { bundleId: id } });
      await tx.documentBundleExport.updateMany({
        where: { bundleId: id },
        data: { storageKey: null },
      });
      await tx.documentBundle.update({ where: { id }, data: { deletedAt: new Date() } });
      return [...files, ...exports].flatMap((row) => row.storageKey ?? []);
    });
    for (const key of keys) await this.discard(key);
  }

  async export(userId: string, id: string, idempotencyKey: string): Promise<BundleExportResponse> {
    await this.find(userId, id);
    const replay = await this.findExport(id, idempotencyKey);
    if (replay) return this.respond(userId, replay);

    let created: DocumentBundleExport;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const bundle = await this.lock(tx, userId, id);
        const files = await tx.documentBundleFile.count({ where: { bundleId: id } });
        if (files < BUNDLE_LIMITS.filesMin) {
          throw new UnprocessableEntityException({ code: ERROR_CODES.BUNDLE_TOO_FEW_FILES });
        }
        const covering = await this.coveringPass(tx, id);
        const passId = covering?.id ?? (await this.charge(tx, userId, id, idempotencyKey));
        return tx.documentBundleExport.create({
          data: { bundleId: id, passId, idempotencyKey, charged: !covering, title: bundle.title },
        });
      });
    } catch (error) {
      // Double clic : la même clé a déjà créé l'export, rien n'est débité une seconde fois.
      const again = isUniqueViolation(error) ? await this.findExport(id, idempotencyKey) : null;
      if (again) return this.respond(userId, again);
      throw error;
    }

    const finished = await this.build(userId, created);
    if (finished.status !== 'ready') {
      throw new ServiceUnavailableException({ code: ERROR_CODES.CAREER_EXPORT_FAILED });
    }
    return this.respond(userId, finished);
  }

  async download(
    userId: string,
    id: string,
    exportId: string,
  ): Promise<CareerExportDownloadResponse> {
    const row = await this.prisma.documentBundleExport.findFirst({
      where: { id: exportId, bundleId: id, bundle: { userId, deletedAt: null } },
    });
    if (!row) throw new NotFoundException({ code: ERROR_CODES.CAREER_EXPORT_NOT_FOUND });
    if (row.status !== 'ready' || !row.storageKey) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.CAREER_EXPORT_NOT_READY });
    }
    const signed = await this.storage.signedDownloadUrl(row.storageKey, safeFileName(row.title));
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }

  /** Contenu vérifié : PDF lisible et non protégé, ou image ré-encodée sans ses métadonnées. */
  private async receive(
    buffer: Buffer,
  ): Promise<{ kind: 'pdf' | 'image'; content: Buffer; pages: number }> {
    // Les éléments actifs d'un PDF ne sont pas refusés ici : le fichier n'est jamais redistribué tel
    // quel et l'assemblage ne reprend que le contenu des pages.
    if (inspectPdf(buffer) === 'not_pdf') {
      const image = await normalizeDocumentImage(buffer);
      if (!image) throw new BadRequestException({ code: ERROR_CODES.FILE_TYPE_NOT_ALLOWED });
      return { kind: 'image', content: image.jpeg, pages: 1 };
    }
    try {
      return { kind: 'pdf', content: buffer, pages: await this.assembly.inspect(buffer) };
    } catch (error) {
      if (!(error instanceof PdfAssemblyError)) throw error;
      // Serveur chargé ou fichier anormalement long à lire : l'utilisateur peut réessayer.
      if (error.reason === 'timeout') {
        throw new ServiceUnavailableException({ code: ERROR_CODES.SERVICE_UNAVAILABLE });
      }
      throw new BadRequestException({
        code:
          error.reason === 'protected'
            ? ERROR_CODES.BUNDLE_PDF_PROTECTED
            : ERROR_CODES.BUNDLE_PDF_UNREADABLE,
      });
    }
  }

  private async build(userId: string, row: DocumentBundleExport): Promise<DocumentBundleExport> {
    let storageKey: string | null = null;
    try {
      const files = await this.prisma.documentBundleFile.findMany({
        where: { bundleId: row.bundleId },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      });
      const parts = await Promise.all(
        files.map(async (file) => ({
          kind: file.kind,
          data: await this.storage.read(file.storageKey),
        })),
      );
      const { pdf, pages } = await this.assembly.assemble(row.title, parts);
      storageKey = `document-bundles/${userId}/${row.bundleId}/exports/${row.id}.pdf`;
      await this.storage.put(
        storageKey,
        pdf,
        'application/pdf',
        createHash('sha256').update(pdf).digest('base64'),
      );
      const key = storageKey;
      return await this.prisma.$transaction(async (tx) => {
        // Dossier supprimé pendant l'assemblage : le PDF ne doit pas survivre à l'effacement.
        await this.lock(tx, userId, row.bundleId);
        return tx.documentBundleExport.update({
          where: { id: row.id },
          data: {
            status: 'ready',
            storageKey: key,
            sizeBytes: pdf.length,
            pageCount: pages,
            completedAt: new Date(),
          },
        });
      });
    } catch (error) {
      if (storageKey) await this.discard(storageKey);
      this.logger.error(`Dossier ${row.bundleId}, export ${row.id} : ${(error as Error).message}`);
      return this.prisma.documentBundleExport.update({
        where: { id: row.id },
        data: { status: 'failed', failureReason: (error as Error).message.slice(0, 120) },
      });
    }
  }

  /** Paiement couvrant un export : période en cours, ou dernier paiement sans export abouti. */
  private async coveringPass(
    db: Tx | PrismaService,
    bundleId: string,
  ): Promise<{ id: string; validUntil: Date } | null> {
    const latest = await db.documentBundlePass.findFirst({
      where: { bundleId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, validUntil: true, exports: { where: { status: 'ready' }, take: 1 } },
    });
    if (!latest) return null;
    return latest.validUntil > new Date() || latest.exports.length === 0 ? latest : null;
  }

  private async charge(
    tx: Tx,
    userId: string,
    bundleId: string,
    idempotencyKey: string,
  ): Promise<string> {
    const cost = await this.settings.requireCost('doc_bundle', tx).catch(() => {
      throw new ServiceUnavailableException({ code: ERROR_CODES.CAREER_EXPORT_PRICE_MISSING });
    });
    const windowDays = await this.windowDays(tx);
    const passId = uuidv7();
    const consumed = await this.credits.consume(tx, {
      userId,
      service: 'doc_bundle',
      credits: cost,
      idempotencyKey: `document-bundle:${bundleId}:${idempotencyKey}`,
      referenceType: 'document_bundle_pass',
      referenceId: passId,
    });
    const now = Date.now();
    await tx.documentBundlePass.create({
      data: {
        id: passId,
        bundleId,
        credits: cost,
        movementId: consumed.movementId,
        valueUsd: consumed.valueUsd,
        createdAt: new Date(now),
        validUntil: new Date(now + windowDays * DAY_MS),
      },
    });
    return passId;
  }

  private windowDays(db: Tx | PrismaService): Promise<number> {
    return this.settings
      .require('studio_reexport_window_days', db)
      .then((value) => value.toNumber())
      .catch(() => 0);
  }

  private findExport(bundleId: string, idempotencyKey: string) {
    return this.prisma.documentBundleExport.findUnique({
      where: { bundleId_idempotencyKey: { bundleId, idempotencyKey } },
    });
  }

  private async respond(userId: string, row: DocumentBundleExport): Promise<BundleExportResponse> {
    return { id: row.id, status: row.status, bundle: await this.get(userId, row.bundleId) };
  }

  private async find(userId: string, id: string) {
    const bundle = await this.prisma.documentBundle.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true },
    });
    if (!bundle) throw new NotFoundException({ code: ERROR_CODES.BUNDLE_NOT_FOUND });
    return bundle;
  }

  private async lock(tx: Tx, userId: string, id: string): Promise<{ title: string }> {
    const rows = await tx.$queryRaw<{ title: string }[]>`
      SELECT "title" FROM "document_bundles"
      WHERE "id" = ${id}::uuid AND "user_id" = ${userId}::uuid AND "deleted_at" IS NULL
      FOR UPDATE`;
    if (!rows[0]) throw new NotFoundException({ code: ERROR_CODES.BUNDLE_NOT_FOUND });
    return rows[0];
  }

  private async discard(key: string): Promise<void> {
    await this.storage.remove(key).catch((error: unknown) => {
      this.logger.error(`Objet ${key} non supprimé : ${(error as Error).message}`);
    });
  }
}
