import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readImageHeader } from './image-header';

/** Refus avant tout décodage : côté et surface maximaux (50 mégapixels, photo de téléphone). */
const MAX_SIDE = 12_000;
const MAX_PIXELS = 50_000_000;
/** Plus grand côté conservé : une page de document reste parfaitement lisible. */
const TARGET_SIDE = 2_200;
const JPEG_QUALITY = 85;

export interface DocumentImage {
  jpeg: Buffer;
  width: number;
  height: number;
}

/**
 * Image d'un document (capture, photo ou scan en JPEG, PNG ou WebP) : format et dimensions lus dans
 * l'en-tête, puis image redressée, réduite si besoin et ré-encodée en JPEG sur fond blanc. Les
 * métadonnées (position GPS, appareil) et tout contenu étranger à l'image disparaissent.
 * Renvoie null si le contenu n'est pas une image acceptée.
 */
export async function normalizeDocumentImage(content: Buffer): Promise<DocumentImage | null> {
  const header = readImageHeader(content);
  if (
    !header ||
    header.width < 1 ||
    header.height < 1 ||
    Math.max(header.width, header.height) > MAX_SIDE ||
    header.width * header.height > MAX_PIXELS
  ) {
    return null;
  }
  try {
    // Le décodeur applique l'orientation EXIF : une photo prise en portrait reste droite.
    const image = await loadImage(content);
    const scale = Math.min(1, TARGET_SIDE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return { jpeg: await canvas.encode('jpeg', JPEG_QUALITY), width, height };
  } catch {
    return null;
  }
}
