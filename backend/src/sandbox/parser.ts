import { createCanvas } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';
import { dirname, join } from 'node:path';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as XLSX from 'xlsx';
import { fail } from './types';

type ParsedSource = { text: string; locator: Record<string, any> };
export async function parseDocument(
  bytes: Buffer,
  filename: string,
  progress: () => Promise<void> = async () => {},
) {
  let rendition: Buffer | undefined;
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'docx') {
    const folder = await mkdtemp(join(tmpdir(), 'angainor-docx-'));
    try {
      const input = join(folder, 'source.docx');
      await writeFile(input, bytes, { mode: 0o600 });
      await promisify(execFile)(
        process.env.SOFFICE_PATH || 'soffice',
        [
          `-env:UserInstallation=file://${join(folder, 'profile')}`,
          '--headless',
          '--convert-to',
          'pdf',
          '--outdir',
          folder,
          input,
        ],
        { timeout: 90000, maxBuffer: 1024 * 1024 },
      );
      rendition = await readFile(join(folder, 'source.pdf'));
      bytes = rendition;
    } catch {
      fail(
        422,
        'DOCX_CONVERSION_FAILED',
        'DOCX could not be converted. LibreOffice is required on the worker; the original file is retained.',
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
  if (extension === 'xlsx' || extension === 'csv') {
    const workbook = XLSX.read(bytes, {
      type: 'buffer',
      cellFormula: true,
      sheetRows: 1001,
    });
    if (workbook.SheetNames.length > 20)
      fail(422, 'WORKBOOK_LIMIT', 'Use a workbook with at most 20 sheets.');
    const sources: ParsedSource[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: '',
        raw: false,
      });
      if (rows.length > 1000)
        fail(422, 'WORKBOOK_LIMIT', 'Use at most 1,000 rows per sheet.');
      rows.forEach((row, index) => {
        if (row.length > 50)
          fail(422, 'WORKBOOK_LIMIT', 'Use at most 50 columns per sheet.');
        const text = row.map((v) => String(v)).join(' | ');
        if (text.trim())
          sources.push({
            text,
            locator: {
              sheet: sheetName,
              cells: `A${index + 1}:${XLSX.utils.encode_col(Math.max(0, row.length - 1))}${index + 1}`,
              method: 'spreadsheet_cached_values',
              formulaValuesUnverified: true,
            },
          });
      });
    }
    return { sources, rendition };
  }
  if (extension !== 'pdf' && extension !== 'docx')
    fail(415, 'UNSUPPORTED_FILE', 'Upload PDF, DOCX, XLSX or CSV.');
  if (bytes.subarray(0, 5).toString() !== '%PDF-')
    fail(415, 'INVALID_PDF', 'The file is not a valid PDF.');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
  });
  const pdf = await loading.promise;
  let ocr: Awaited<ReturnType<typeof createWorker>> | undefined;
  try {
    if (pdf.numPages > 80)
      fail(
        422,
        'PAGE_LIMIT',
        'Split this document into files of at most 80 pages.',
      );
    const sources: ParsedSource[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      await progress();
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      let text = content.items
        .map((item: any) =>
          item.str ? item.str + (item.hasEOL ? '\n' : ' ') : '',
        )
        .join('')
        .trim();
      let method = 'native_pdf',
        confidence: number | undefined;
      if (text.replace(/\s/g, '').length < 40) {
        if (!ocr)
          ocr = await createWorker('eng', 1, {
            langPath: join(
              dirname(require.resolve('@tesseract.js-data/eng/package.json')),
              '4.0.0',
            ),
            cacheMethod: 'none',
            gzip: true,
          });
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: Math.min(2, 2800 / Math.max(base.width, base.height)),
        });
        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        await page.render({
          canvasContext: canvas.getContext('2d') as any,
          viewport,
          canvas: canvas as any,
        }).promise;
        const result = await ocr.recognize(canvas.toBuffer('image/png'));
        text = result.data.text.trim();
        confidence = result.data.confidence;
        method = 'local_tesseract_english';
      }
      if (text) {
        // Keep page coordinates exact; smaller spans make citation inspection practical.
        const paragraphs = text.split(/\n\s*\n/);
        for (const paragraph of paragraphs)
          for (let offset = 0; offset < paragraph.length; offset += 2500) {
            sources.push({
              text: paragraph.slice(offset, offset + 2500),
              locator: {
                page: number,
                method,
                confidence,
                rendition: extension === 'docx',
                requiresReview: method.includes('tesseract'),
              },
            });
          }
      }
      page.cleanup();
    }
    if (!sources.length)
      fail(
        422,
        'NO_READABLE_TEXT',
        'No readable text was found. Review the scan quality.',
      );
    if (sources.reduce((n, s) => n + s.text.length, 0) > 800000)
      fail(
        422,
        'TEXT_LIMIT',
        'Document text exceeds this sandbox processing limit.',
      );
    return { sources, rendition };
  } finally {
    await ocr?.terminate();
    await loading.destroy();
  }
}
