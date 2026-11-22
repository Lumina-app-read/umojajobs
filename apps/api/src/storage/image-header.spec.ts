import { createCanvas } from '@napi-rs/canvas';
import { readImageHeader } from './image-header';

describe('Career Studio : lecture de l’en-tête des images', () => {
  it('lit le format et les dimensions des JPEG, PNG et WebP sans les décoder', async () => {
    const canvas = createCanvas(320, 200);
    canvas.getContext('2d').fillRect(0, 0, 320, 200);
    expect(readImageHeader(await canvas.encode('jpeg', 80))).toEqual({
      type: 'image/jpeg',
      width: 320,
      height: 200,
    });
    expect(readImageHeader(await canvas.encode('png'))).toEqual({
      type: 'image/png',
      width: 320,
      height: 200,
    });
    expect(readImageHeader(await canvas.encode('webp', 80))).toEqual({
      type: 'image/webp',
      width: 320,
      height: 200,
    });
  });

  it('expose les dimensions démesurées d’une image piégée et refuse le reste', async () => {
    const png = Buffer.from(await createCanvas(2, 2).encode('png'));
    png.writeUInt32BE(100_000, 16);
    png.writeUInt32BE(100_000, 20);
    expect(readImageHeader(png)).toMatchObject({ width: 100_000, height: 100_000 });
    expect(readImageHeader(Buffer.from('%PDF-1.7 ceci n’est pas une image, vraiment'))).toBeNull();
    expect(readImageHeader(Buffer.alloc(10))).toBeNull();
  });
});
