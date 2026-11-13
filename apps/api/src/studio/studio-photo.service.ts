import { createHash } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ERROR_CODES, PHOTO_LIMITS } from '@opportinities/shared';
import { uuidv7 } from '../common/uuid-v7';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { readImageHeader } from './image-header';
import { photoVersion } from './studio.service';

/** Au-delà, l'image est refusée avant tout décodage (protection mémoire). */
const MAX_SIDE = 8_000;

export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

/**
 * Photo du CV : facultative, stockée en privé, jamais envoyée à l'IA. L'image reçue est
 * vérifiée (format et dimensions lus dans l'en-tête), recadrée en carré, redimensionnée et
 * ré-encodée en JPEG : les métadonnées (position GPS, appareil) ne sont jamais conservées.
 */
@Injectable()
export class StudioPhotoService {
  private readonly logger = new Logger(StudioPhotoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async upload(
    userId: string,
    documentId: string,
    file: UploadedImage | undefined,
  ): Promise<{ version: string }> {
    const document = await this.findCv(userId, documentId);
    if (!file || file.size === 0 || file.size > PHOTO_LIMITS.maxBytes) {
      throw new BadRequestException({ code: ERROR_CODES.CAREER_PHOTO_INVALID });
    }
    const header = readImageHeader(file.buffer);
    if (
      !header ||
      header.width < 1 ||
      header.height < 1 ||
      header.width > MAX_SIDE ||
      header.height > MAX_SIDE
    ) {
      throw new BadRequestException({ code: ERROR_CODES.CAREER_PHOTO_INVALID });
    }

    let jpeg: Buffer;
    try {
      const image = await loadImage(file.buffer);
      const side = Math.min(image.width, image.height);
      const canvas = createCanvas(PHOTO_LIMITS.size, PHOTO_LIMITS.size);
      const context = canvas.getContext('2d');
      // Recadrage centré (portrait ou paysage) puis réduction à la taille enregistrée.
      context.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        PHOTO_LIMITS.size,
        PHOTO_LIMITS.size,
      );
      jpeg = await canvas.encode('jpeg', 85);
    } catch {
      throw new BadRequestException({ code: ERROR_CODES.CAREER_PHOTO_INVALID });
    }

    const key = `career-photos/${userId}/${uuidv7()}.jpg`;
    await this.storage.put(
      key,
      jpeg,
      'image/jpeg',
      createHash('sha256').update(jpeg).digest('base64'),
    );
    await this.prisma.careerDocument.update({
      where: { id: document.id },
      data: { photoStorageKey: key },
    });
    if (document.photoStorageKey) await this.discard(document.photoStorageKey);
    return { version: photoVersion(key) };
  }

  /** Image de la photo, pour l'aperçu de l'éditeur (réservée au propriétaire du document). */
  async read(userId: string, documentId: string): Promise<Buffer> {
    const document = await this.findCv(userId, documentId);
    if (!document.photoStorageKey) {
      throw new NotFoundException({ code: ERROR_CODES.CAREER_PHOTO_NOT_FOUND });
    }
    return this.storage.read(document.photoStorageKey);
  }

  async remove(userId: string, documentId: string): Promise<void> {
    const document = await this.findCv(userId, documentId);
    if (!document.photoStorageKey) return;
    await this.prisma.careerDocument.update({
      where: { id: document.id },
      data: { photoStorageKey: null },
    });
    await this.discard(document.photoStorageKey);
  }

  /** Supprime une ancienne image, sauf si un export l'utilise encore (PDF déjà payés). */
  private async discard(key: string): Promise<void> {
    const used = await this.prisma.careerDocumentExport.count({ where: { photoStorageKey: key } });
    if (used > 0) return;
    await this.storage.remove(key).catch((error: unknown) => {
      this.logger.warn(`Photo ${key} non supprimée : ${(error as Error).message}`);
    });
  }

  private async findCv(userId: string, documentId: string) {
    const document = await this.prisma.careerDocument.findFirst({
      where: { id: documentId, userId, deletedAt: null },
      select: { id: true, type: true, photoStorageKey: true },
    });
    if (!document) throw new NotFoundException({ code: ERROR_CODES.CAREER_DOCUMENT_NOT_FOUND });
    if (document.type !== 'cv') {
      throw new UnprocessableEntityException({ code: ERROR_CODES.CAREER_PHOTO_INVALID });
    }
    return document;
  }
}
