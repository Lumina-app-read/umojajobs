import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EDITABLE_JOB_STATUSES,
  ERROR_CODES,
  type FileDownloadResponse,
  JOB_LIMITS,
  type JobFileKind,
  type JobOfferResponse,
} from '@opportinities/shared';
import { type AuthContext } from '../auth/auth-context';
import { type ClientInfo } from '../common/http/app-request';
import { uuidv7 } from '../common/uuid-v7';
import { type EnvironmentVariables } from '../config/env.validation';
import { type FileDownloadPurpose, type Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { inspectPdf, safeFileName } from '../storage/pdf-inspection';
import { StorageService } from '../storage/storage.service';
import { JOB_OFFER_INCLUDE, toJobOfferResponse } from './job-offer.mapper';

/** Fichier reçu par multer (stockage en mémoire, jamais écrit sur le disque du serveur). */
export interface UploadedPdf {
  buffer: Buffer;
  size: number;
  originalname: string;
  mimetype: string;
}

/**
 * Documents privés des offres (cahier des charges §7.2 et §8.4) : dépôt contrôlé (PDF sans
 * élément actif, taille limitée), stockage hors accès public, téléchargement par lien signé de
 * courte durée après vérification des droits, chaque téléchargement étant journalisé.
 */
@Injectable()
export class JobOfferFilesService {
  private readonly logger = new Logger(JobOfferFilesService.name);
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxBytes = config.get('JOB_FILE_MAX_MB', { infer: true }) * 1024 * 1024;
  }

  async upload(
    auth: AuthContext,
    offerId: string,
    kind: JobFileKind,
    file: UploadedPdf | undefined,
    client: ClientInfo,
  ): Promise<JobOfferResponse> {
    const offer = await this.prisma.jobOffer.findFirst({
      where: { id: offerId, contributorId: auth.user.id },
      select: { id: true, status: true },
    });
    if (!offer) throw new NotFoundException({ code: ERROR_CODES.JOB_OFFER_NOT_FOUND });
    if (!EDITABLE_JOB_STATUSES.includes(offer.status)) {
      throw new ConflictException({ code: ERROR_CODES.JOB_OFFER_NOT_EDITABLE });
    }
    if (!file || file.size === 0)
      throw new BadRequestException({ code: ERROR_CODES.FILE_REQUIRED });
    if (file.size > this.maxBytes) {
      throw new PayloadTooLargeException({
        code: ERROR_CODES.FILE_TOO_LARGE,
        meta: { maxMegabytes: this.maxBytes / 1024 / 1024 },
      });
    }
    const problem = inspectPdf(file.buffer);
    if (problem === 'not_pdf') {
      throw new BadRequestException({ code: ERROR_CODES.FILE_TYPE_NOT_ALLOWED });
    }
    if (problem === 'active_content') {
      this.logger.warn(`PDF refusé (éléments actifs) [${client.requestId}] offre ${offerId}`);
      throw new BadRequestException({ code: ERROR_CODES.FILE_UNSAFE });
    }

    const active = await this.prisma.jobOfferFile.groupBy({
      by: ['kind'],
      where: { jobOfferId: offerId, deletedAt: null },
      _count: true,
    });
    const count = (wanted: JobFileKind) => active.find((row) => row.kind === wanted)?._count ?? 0;
    if (
      (kind === 'original' && count('original') >= 1) ||
      (kind === 'attachment' && count('attachment') >= JOB_LIMITS.attachmentsMax)
    ) {
      throw new ConflictException({ code: ERROR_CODES.FILE_LIMIT_REACHED, meta: { kind } });
    }

    const digest = createHash('sha256').update(file.buffer).digest();
    const storageKey = `job-offers/${offerId}/${uuidv7()}.pdf`;
    await this.storage.put(storageKey, file.buffer, 'application/pdf', digest.toString('base64'));
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.jobOfferFile.create({
          data: {
            jobOfferId: offerId,
            uploadedById: auth.user.id,
            kind,
            storageKey,
            originalName: safeFileName(file.originalname),
            mimeType: 'application/pdf',
            sizeBytes: file.size,
            sha256: digest.toString('hex'),
          },
        });
        await tx.jobOffer.update({ where: { id: offerId }, data: { updatedAt: new Date() } });
      });
    } catch (error) {
      // Compensation : pas d'objet orphelin si l'enregistrement échoue (ex. deux originaux en même temps).
      await this.storage.remove(storageKey).catch(() => undefined);
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException({ code: ERROR_CODES.FILE_LIMIT_REACHED, meta: { kind } });
      }
      throw error;
    }
    return this.ownerView(offerId);
  }

  /**
   * Retrait par le contributeur (brouillon ou correction demandée). Le document est conservé
   * dans le stockage : il a pu faire partie d'une version déjà soumise à la modération.
   */
  async remove(auth: AuthContext, offerId: string, fileId: string): Promise<JobOfferResponse> {
    const file = await this.prisma.jobOfferFile.findFirst({
      where: {
        id: fileId,
        jobOfferId: offerId,
        deletedAt: null,
        jobOffer: { contributorId: auth.user.id },
      },
      select: { id: true, jobOffer: { select: { status: true } } },
    });
    if (!file) throw new NotFoundException({ code: ERROR_CODES.FILE_NOT_FOUND });
    if (!EDITABLE_JOB_STATUSES.includes(file.jobOffer.status)) {
      throw new ConflictException({ code: ERROR_CODES.JOB_OFFER_NOT_EDITABLE });
    }
    await this.prisma.jobOfferFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });
    return this.ownerView(offerId);
  }

  /** Téléchargement par le contributeur propriétaire (documents non retirés). */
  ownerDownload(
    auth: AuthContext,
    offerId: string,
    fileId: string,
    client: ClientInfo,
  ): Promise<FileDownloadResponse> {
    return this.download(
      {
        id: fileId,
        jobOfferId: offerId,
        deletedAt: null,
        jobOffer: { contributorId: auth.user.id },
      },
      auth,
      'owner',
      client,
    );
  }

  /** Téléchargement par la modération (offres soumises, documents retirés compris). */
  moderationDownload(
    auth: AuthContext,
    offerId: string,
    fileId: string,
    client: ClientInfo,
  ): Promise<FileDownloadResponse> {
    return this.download(
      { id: fileId, jobOfferId: offerId, jobOffer: { status: { not: 'draft' } } },
      auth,
      'moderation',
      client,
    );
  }

  private async download(
    where: Prisma.JobOfferFileWhereInput,
    auth: AuthContext,
    purpose: FileDownloadPurpose,
    client: ClientInfo,
  ): Promise<FileDownloadResponse> {
    const file = await this.prisma.jobOfferFile.findFirst({
      where,
      select: { id: true, storageKey: true, originalName: true },
    });
    if (!file) throw new NotFoundException({ code: ERROR_CODES.FILE_NOT_FOUND });
    await this.prisma.fileDownloadLog.create({
      data: {
        fileId: file.id,
        userId: auth.user.id,
        purpose,
        ip: client.ip,
        userAgent: client.userAgent,
        requestId: client.requestId,
      },
    });
    const { url, expiresAt } = await this.storage.signedDownloadUrl(
      file.storageKey,
      file.originalName,
    );
    return { url, expiresAt: expiresAt.toISOString() };
  }

  private async ownerView(offerId: string): Promise<JobOfferResponse> {
    const offer = await this.prisma.jobOffer.findUniqueOrThrow({
      where: { id: offerId },
      include: JOB_OFFER_INCLUDE,
    });
    return toJobOfferResponse(offer);
  }
}
