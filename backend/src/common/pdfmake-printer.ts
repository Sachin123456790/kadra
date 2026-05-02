/**
 * Shared pdfmake printer. pdfmake 0.3.x ships only standard 14 fonts and needs
 * the AFM bytes wired through a virtual filesystem at `data/<font>.afm`. The
 * printer is heavy (reads + parses 8 AFMs) so we cache one per process.
 *
 * Used by both notices/pdfmake-renderer (markdown notices) and
 * audit/gp-admin-export-renderer (institutional GP/Admin export PDF).
 */

let cachedPrinter: unknown = null;

function getPrinter() {
  if (cachedPrinter) return cachedPrinter as { createPdfKitDocument: Function };
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const PdfPrinter = require('pdfmake/js/Printer').default;
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const fs = require('fs');

  const readAfm = (name: string) =>
    fs.readFileSync(require.resolve(`pdfkit/js/data/${name}`), 'utf8');
  const vfsData: Record<string, string> = {
    'data/Helvetica.afm': readAfm('Helvetica.afm'),
    'data/Helvetica-Bold.afm': readAfm('Helvetica-Bold.afm'),
    'data/Helvetica-Oblique.afm': readAfm('Helvetica-Oblique.afm'),
    'data/Helvetica-BoldOblique.afm': readAfm('Helvetica-BoldOblique.afm'),
    'data/Courier.afm': readAfm('Courier.afm'),
    'data/Courier-Bold.afm': readAfm('Courier-Bold.afm'),
    'data/Courier-Oblique.afm': readAfm('Courier-Oblique.afm'),
    'data/Courier-BoldOblique.afm': readAfm('Courier-BoldOblique.afm'),
  };
  const virtualfs = {
    existsSync: (p: string) => Object.prototype.hasOwnProperty.call(vfsData, p),
    readFileSync: (p: string) => vfsData[p],
    writeFileSync: () => undefined,
  };
  const fonts = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
    Courier: {
      normal: 'Courier',
      bold: 'Courier-Bold',
      italics: 'Courier-Oblique',
      bolditalics: 'Courier-BoldOblique',
    },
  };
  const noopUrlResolver = {
    resolve: () => Promise.resolve(),
    resolved: () => Promise.resolve([]),
  };
  cachedPrinter = new PdfPrinter(fonts, virtualfs, noopUrlResolver);
  return cachedPrinter as { createPdfKitDocument: Function };
}

export async function createPdfBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docDefinition: any,
): Promise<Buffer> {
  const pdfDoc = await getPrinter().createPdfKitDocument(docDefinition);
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    pdfDoc.on('data', (c: Buffer) => chunks.push(c));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}
