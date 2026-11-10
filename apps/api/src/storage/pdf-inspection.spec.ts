import { inspectPdf, safeFileName } from './pdf-inspection';

const pdf = (body: string) => Buffer.from(`%PDF-1.7\n${body}\n%%EOF`);

describe('contrôle des PDF', () => {
  it('accepte un PDF simple', () => {
    expect(inspectPdf(pdf('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj'))).toBeNull();
  });

  it('refuse un fichier qui n’est pas un PDF, quel que soit son nom', () => {
    expect(inspectPdf(Buffer.from('MZ\x90\x00 exécutable'))).toBe('not_pdf');
    expect(inspectPdf(Buffer.from('<html>%PDF-</html>'.padStart(2000, ' ')))).toBe('not_pdf');
  });

  it('refuse les éléments actifs', () => {
    expect(inspectPdf(pdf('<< /S /JavaScript /JS (app.alert(1)) >>'))).toBe('active_content');
    expect(inspectPdf(pdf('<< /OpenAction 5 0 R >>'))).toBe('active_content');
    expect(inspectPdf(pdf('<< /Type /EmbeddedFile >>'))).toBe('active_content');
  });

  it('ne confond pas un marqueur avec un nom plus long', () => {
    expect(inspectPdf(pdf('<< /JSONData 1 /AAPL 2 >>'))).toBeNull();
  });
});

describe('nom de fichier', () => {
  it('retire chemin, caractères dangereux et force l’extension .pdf', () => {
    expect(safeFileName('C:\\Users\\a\\Offre "RH".PDF')).toBe('Offre RH.pdf');
    expect(safeFileName('../../etc/passwd')).toBe('passwd.pdf');
    expect(safeFileName('   ')).toBe('document.pdf');
  });
});
