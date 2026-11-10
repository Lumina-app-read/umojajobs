/**
 * Contrôles d'un PDF reçu, avant tout stockage. Le type déclaré par le navigateur n'est pas
 * fiable : seule la signature du contenu compte. Les PDF contenant des éléments actifs
 * (JavaScript, lancement d'application, fichiers incorporés) sont refusés : ils n'ont rien à
 * faire dans une annonce d'emploi et constituent le principal vecteur d'attaque par PDF.
 */

const PDF_SIGNATURE = Buffer.from('%PDF-');

/** Marqueurs d'éléments actifs dans la structure d'un PDF. */
const ACTIVE_CONTENT = [
  '/JavaScript',
  '/JS',
  '/Launch',
  '/EmbeddedFile',
  '/RichMedia',
  '/OpenAction',
  '/AA',
  '/XFA',
].map((marker) => Buffer.from(marker));

export type PdfProblem = 'not_pdf' | 'active_content';

export function inspectPdf(content: Buffer): PdfProblem | null {
  // La signature doit apparaître dans les premiers octets (la norme tolère un court préambule).
  const head = content.subarray(0, 1024);
  if (head.indexOf(PDF_SIGNATURE) === -1) return 'not_pdf';
  for (const marker of ACTIVE_CONTENT) {
    let index = content.indexOf(marker);
    while (index !== -1) {
      // Marqueur complet uniquement : « /JS » ne doit pas correspondre à « /JSomething ».
      const next = content[index + marker.length];
      if (next === undefined || !isNameCharacter(next)) return 'active_content';
      index = content.indexOf(marker, index + marker.length);
    }
  }
  return null;
}

/** Caractère pouvant prolonger un nom PDF (lettres, chiffres, quelques signes). */
function isNameCharacter(byte: number): boolean {
  return (
    (byte >= 0x30 && byte <= 0x39) ||
    (byte >= 0x41 && byte <= 0x5a) ||
    (byte >= 0x61 && byte <= 0x7a) ||
    byte === 0x2d ||
    byte === 0x5f ||
    byte === 0x2e
  );
}

/** Nom de fichier affichable et sûr : sans chemin, sans caractère de contrôle, extension .pdf. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFC')
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      // Caractères de contrôle et caractères interdits dans les noms de fichiers.
      return code > 0x1f && code !== 0x7f && !'"<>|:*?'.includes(char);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  const withoutExtension = cleaned.replace(/\.pdf$/i, '') || 'document';
  return `${withoutExtension}.pdf`;
}
