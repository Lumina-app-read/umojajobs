/** Format et dimensions d'une image, lus dans son en-tête sans la décoder. */
export interface ImageHeader {
  type: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
}

/**
 * Lit le format et les dimensions dans l'en-tête (JPEG, PNG, WebP). Sert à refuser une image
 * aux dimensions démesurées avant tout décodage (une « bombe » de quelques Ko peut réclamer
 * plusieurs Go de mémoire une fois décodée). Renvoie null pour tout autre contenu.
 */
export function readImageHeader(data: Buffer): ImageHeader | null {
  if (data.length < 30) return null;
  // PNG : signature, puis bloc IHDR (largeur et hauteur sur 4 octets).
  if (data.readUInt32BE(0) === 0x89504e47 && data.toString('ascii', 12, 16) === 'IHDR') {
    return { type: 'image/png', width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  // WebP : conteneur RIFF, puis VP8 (avec pertes), VP8L (sans pertes) ou VP8X (étendu).
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = data.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') {
      return {
        type: 'image/webp',
        width: data.readUInt16LE(26) & 0x3fff,
        height: data.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === 'VP8L') {
      const bits = data.readUInt32LE(21);
      return {
        type: 'image/webp',
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    if (chunk === 'VP8X') {
      return {
        type: 'image/webp',
        width: data.readUIntLE(24, 3) + 1,
        height: data.readUIntLE(27, 3) + 1,
      };
    }
    return null;
  }
  // JPEG : parcours des segments jusqu'au marqueur SOF (début d'image) qui porte les dimensions.
  if (data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) return null;
      const marker = data[offset + 1] as number;
      const length = data.readUInt16BE(offset + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof) {
        return {
          type: 'image/jpeg',
          height: data.readUInt16BE(offset + 5),
          width: data.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}
