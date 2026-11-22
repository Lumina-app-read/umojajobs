/**
 * Lecture et assemblage de PDF dans un fil séparé : un fichier malveillant ou très lent ne bloque
 * jamais l'API, qui peut interrompre ce fil. Module ES natif, sans dépendance à Nest.
 */
import { parentPort, workerData } from 'node:worker_threads';
import {
  concatTransformationMatrix,
  drawObject,
  PDFArray,
  PDFDict,
  PDFDocument,
  type PDFImage,
  PDFName,
  PDFNumber,
  type PDFPage,
  PDFRef,
  PDFStream,
  popGraphicsState,
  pushGraphicsState,
} from 'pdf-lib';

type Task =
  | { operation: 'inspect'; pdf: Uint8Array }
  | { operation: 'assemble'; title: string; parts: { kind: 'pdf' | 'image'; data: Uint8Array }[] };

/** Page A4 en points, marge autour des images. */
const A4: [number, number] = [595.28, 841.89];
const MARGIN = 28;
/** Seules ces entrées d'une page sont conservées : ni action automatique, ni contenu annexe. */
const PAGE_KEYS = new Set([
  'Type',
  'Parent',
  'Resources',
  'MediaBox',
  'CropBox',
  'Rotate',
  'Contents',
  'Group',
  'UserUnit',
  'Annots',
]);

const name = (value: string) => PDFName.of(value);

/** Lien web ordinaire : la seule annotation conservée (les scripts et lancements disparaissent). */
function isWebLink(annotation: PDFDict): boolean {
  if (annotation.lookup(name('Subtype')) !== name('Link')) return false;
  if (annotation.has(name('AA'))) return false;
  const action = annotation.lookup(name('A'));
  if (!(action instanceof PDFDict) || action.has(name('Next'))) return false;
  return action.lookup(name('S')) === name('URI');
}

const numbers = (value: unknown, length: number): number[] | null => {
  if (!(value instanceof PDFArray) || value.size() !== length) return null;
  const list = value.asArray().map((_, index) => value.lookup(index));
  return list.every((item) => item instanceof PDFNumber)
    ? list.map((item) => item.asNumber())
    : null;
};

/** Apparence visible d'une annotation (texte ajouté, tampon, signature, champ rempli), ou null. */
function appearanceOf(annotation: PDFDict): PDFRef | null {
  const flags = annotation.lookup(name('F'));
  // Annotations masquées (2) ou non affichées (32).
  if (flags instanceof PDFNumber && (flags.asNumber() & (2 | 32)) !== 0) return null;
  const appearances = annotation.lookup(name('AP'));
  if (!(appearances instanceof PDFDict)) return null;
  const context = annotation.context;
  let reference = appearances.get(name('N'));
  const normal = appearances.lookup(name('N'));
  if (normal instanceof PDFDict) {
    const state = annotation.lookup(name('AS'));
    if (!(state instanceof PDFName)) return null;
    reference = normal.get(state);
  }
  if (!(reference instanceof PDFRef)) return null;
  return context.lookup(reference) instanceof PDFStream ? reference : null;
}

/** Dessine l'apparence dans la page (PDF 32000, §12.5.5) : elle devient un contenu ordinaire. */
function drawAppearance(page: PDFPage, annotation: PDFDict): void {
  const reference = appearanceOf(annotation);
  const rect = numbers(annotation.lookup(name('Rect')), 4);
  if (!reference || !rect) return;
  const form = annotation.context.lookup(reference, PDFStream);
  const box = numbers(form.dict.lookup(name('BBox')), 4);
  if (!box) return;
  const [a, b, c, d, e, f] = numbers(form.dict.lookup(name('Matrix')), 6) ?? [1, 0, 0, 1, 0, 0];
  const corners = [
    [box[0]!, box[1]!],
    [box[2]!, box[1]!],
    [box[0]!, box[3]!],
    [box[2]!, box[3]!],
  ].map(([x, y]) => [a! * x! + c! * y! + e!, b! * x! + d! * y! + f!] as const);
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const [left, bottom] = [Math.min(...xs), Math.min(...ys)];
  const [width, height] = [Math.max(...xs) - left, Math.max(...ys) - bottom];
  if (width <= 0 || height <= 0) return;
  const scaleX = Math.abs(rect[2]! - rect[0]!) / width;
  const scaleY = Math.abs(rect[3]! - rect[1]!) / height;
  const key = page.node.newXObject('Annotation', reference);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(
      scaleX,
      0,
      0,
      scaleY,
      Math.min(rect[0]!, rect[2]!) - left * scaleX,
      Math.min(rect[1]!, rect[3]!) - bottom * scaleY,
    ),
    drawObject(key),
    popGraphicsState(),
  );
}

function cleanPage(page: PDFPage): void {
  const annotations = page.node.lookup(name('Annots'));
  const kept: PDFDict[] = [];
  if (annotations instanceof PDFArray) {
    for (let index = 0; index < annotations.size(); index += 1) {
      const annotation = annotations.lookup(index);
      if (!(annotation instanceof PDFDict)) continue;
      if (isWebLink(annotation)) kept.push(annotation);
      else if (annotation.lookup(name('Subtype')) !== name('Popup')) {
        drawAppearance(page, annotation);
      }
    }
  }
  for (const key of page.node.keys()) {
    if (!PAGE_KEYS.has(key.decodeText())) page.node.delete(key);
  }
  page.node.delete(name('Annots'));
  if (kept.length > 0) {
    // Copie minimale : zone cliquable et adresse, sans lien vers le reste du document d'origine.
    const context = page.doc.context;
    const copies = kept.map((annotation) => {
      const action = annotation.lookup(name('A'), PDFDict);
      const uri = action.lookup(name('URI'));
      const rect = annotation.lookup(name('Rect'));
      return uri && rect
        ? context.register(
            context.obj({
              Type: 'Annot',
              Subtype: 'Link',
              Rect: rect,
              Border: [0, 0, 0],
              A: { S: 'URI', URI: uri },
            }),
          )
        : null;
    });
    page.node.set(name('Annots'), context.obj(copies.filter((copy) => copy !== null)));
  }
}

async function load(data: Uint8Array): Promise<PDFDocument> {
  const document = await PDFDocument.load(data, { updateMetadata: false });
  if (document.getPageCount() === 0) throw new Error('PDF sans page');
  return document;
}

function addImagePage(output: PDFDocument, image: PDFImage): void {
  const landscape = image.width > image.height;
  const [width, height] = landscape ? [A4[1], A4[0]] : A4;
  const scale = Math.min((width - 2 * MARGIN) / image.width, (height - 2 * MARGIN) / image.height);
  const page = output.addPage([width, height]);
  page.drawImage(image, {
    x: (width - image.width * scale) / 2,
    y: (height - image.height * scale) / 2,
    width: image.width * scale,
    height: image.height * scale,
  });
}

async function run(task: Task): Promise<{ pages: number; pdf?: Uint8Array }> {
  if (task.operation === 'inspect') return { pages: (await load(task.pdf)).getPageCount() };
  const output = await PDFDocument.create();
  output.setTitle(task.title, { showInWindowTitleBar: true });
  output.setProducer('Umoja Jobs');
  output.setCreator('Umoja Jobs');
  for (const part of task.parts) {
    // Copie : pdf-lib lit le tampon entier, sans tenir compte du décalage d'une vue partagée.
    if (part.kind === 'image') {
      addImagePage(output, await output.embedJpg(Uint8Array.from(part.data)));
      continue;
    }
    const source = await load(part.data);
    try {
      // Les valeurs saisies dans un formulaire deviennent du texte fixe de la page.
      const form = source.getForm();
      if (form.getFields().length > 0) form.flatten();
    } catch {
      // Formulaire non standard : les pages sont reprises sans ses champs.
    }
    source.getPages().forEach(cleanPage);
    for (const page of await output.copyPages(source, source.getPageIndices())) {
      output.addPage(page);
    }
  }
  return { pages: output.getPageCount(), pdf: await output.save() };
}

try {
  parentPort?.postMessage({ ok: true, ...(await run(workerData as Task)) });
} catch (error) {
  parentPort?.postMessage({
    ok: false,
    // La classe d'erreur de pdf-lib (cible ES5) ne se reconnaît pas par instanceof.
    reason:
      error instanceof Error && error.message.includes('is encrypted') ? 'protected' : 'unreadable',
  });
}
