import { dirname, join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import type Redis from 'ioredis';
import type * as PdfJsModule from 'pdfjs-dist/legacy/build/pdf.mjs';
import { REDIS_CLIENT } from '../redis/redis.module';
import { StorageService } from '../storage/storage.service';

/** Largeur de rendu d'une page, en pixels : lisible sur écran, sans fournir une copie haute définition. */
const TARGET_WIDTH = 1240;
const MAX_SCALE = 2.5;
/** Au-delà, les pages suivantes ne sont pas proposées (une annonce dépasse rarement quelques pages). */
export const MAX_RENDERED_PAGES = 30;
const CACHE_TTL_SECONDS = 6 * 60 * 60;
// v2 : mention « Publiée par … sur Umoja Jobs » (changement de nom).
const CACHE_VERSION = 'v2';

type PdfJs = typeof PdfJsModule;
type LoadingTask = ReturnType<PdfJs['getDocument']>;

export interface RenderSource {
  fileId: string;
  storageKey: string;
  /** Mention incrustée sur chaque page : « Publiée par … sur Umoja Jobs ». */
  watermark: string;
}

/**
 * Affichage des documents dans le site, jamais en téléchargement : chaque page est rendue
 * côté serveur en image, avec la mention de publication incrustée. Le PDF d'origine ne quitte
 * jamais le stockage privé. Les pages rendues sont mises en cache (la mention dépend du
 * contributeur, pas du lecteur).
 */
@Injectable()
export class DocumentRenderService {
  private pdfjs: Promise<PdfJs> | null = null;

  constructor(
    private readonly storage: StorageService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async pageCount(source: RenderSource): Promise<number> {
    const cacheKey = `doc:${CACHE_VERSION}:${source.fileId}:pages`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return Number(cached);
    const task = await this.open(source.storageKey);
    try {
      const document = await task.promise;
      const count = Math.min(document.numPages, MAX_RENDERED_PAGES);
      await this.redis.set(cacheKey, String(count), 'EX', CACHE_TTL_SECONDS);
      return count;
    } finally {
      await task.destroy();
    }
  }

  /** Page (1 à n) en WebP, mention incrustée. */
  async page(source: RenderSource, pageNumber: number): Promise<Buffer> {
    const cacheKey = `doc:${CACHE_VERSION}:${source.fileId}:${pageNumber}`;
    const cached = await this.redis.getBuffer(cacheKey);
    if (cached) return cached;

    const task = await this.open(source.storageKey);
    try {
      const document = await task.promise;
      const page = await document.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(MAX_SCALE, TARGET_WIDTH / base.width) });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      // Le canevas Skia remplace le canevas du navigateur ; pdf.js en obtient lui-même le contexte 2D.
      // (Les types DOM ne sont pas chargés côté serveur, d'où la conversion.)
      await page.render({ canvas: canvas as never, viewport }).promise;
      drawWatermark(context, canvas.width, canvas.height, source.watermark);
      const image = await canvas.encode('webp', 82);
      await this.redis.set(cacheKey, image, 'EX', CACHE_TTL_SECONDS);
      return image;
    } finally {
      await task.destroy();
    }
  }

  /** Chargement du PDF depuis le stockage privé ; l'appelant libère la tâche (destroy). */
  private async open(storageKey: string): Promise<LoadingTask> {
    this.pdfjs ??= import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfjs = await this.pdfjs;
    const data = new Uint8Array(await this.storage.read(storageKey));
    return pdfjs.getDocument({
      data,
      disableFontFace: true,
      standardFontDataUrl: `${join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')}/`,
      verbosity: 0,
    });
  }
}

/**
 * Mention répétée en diagonale, discrète mais impossible à recadrer, plus un bandeau lisible
 * en bas de page.
 */
function drawWatermark(context: SKRSContext2D, width: number, height: number, text: string): void {
  const size = Math.round(width / 42);
  context.save();
  context.translate(width / 2, height / 2);
  context.rotate(-Math.PI / 6);
  context.font = `600 ${size}px sans-serif`;
  context.fillStyle = 'rgba(30, 64, 175, 0.10)';
  context.textAlign = 'center';
  const step = size * 7;
  const span = Math.hypot(width, height);
  for (let y = -span; y <= span; y += step) {
    for (let x = -span; x <= span; x += context.measureText(text).width + size * 4) {
      context.fillText(text, x, y);
    }
  }
  context.restore();

  const band = Math.round(size * 2.2);
  context.fillStyle = 'rgba(15, 23, 42, 0.78)';
  context.fillRect(0, height - band, width, band);
  context.font = `600 ${Math.round(size * 0.9)}px sans-serif`;
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height - band / 2);
}
