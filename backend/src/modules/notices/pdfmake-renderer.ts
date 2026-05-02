/**
 * Markdown → PDF using pdfmake.
 *
 * We feed the markdown body through marked.lexer() to get a flat token
 * stream, then map each token to a pdfmake content node. This is intentionally
 * a small, self-contained subset of markdown — heading, paragraph, list
 * (ordered/unordered), table, blockquote, hr, code. Anything fancier
 * (images, links beyond text, footnotes) just renders as text. Goal is a
 * clean institutional-looking document, not full markdown fidelity.
 */

import type {
  Content,
  StyleDictionary,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import type { Token, Tokens } from 'marked';
import { createPdfBuffer } from '../../common/pdfmake-printer';

let markedLexer: ((src: string) => Token[]) | null = null;
async function getLexer(): Promise<(src: string) => Token[]> {
  if (markedLexer) return markedLexer;
  const marked = await import('marked');
  markedLexer = marked.lexer;
  return markedLexer;
}

const STYLES: StyleDictionary = {
  h1: { fontSize: 22, bold: true, margin: [0, 4, 0, 12] },
  h2: { fontSize: 16, bold: true, margin: [0, 12, 0, 6] },
  h3: { fontSize: 13, bold: true, margin: [0, 10, 0, 4] },
  paragraph: { fontSize: 11, margin: [0, 0, 0, 8], lineHeight: 1.35 },
  small: { fontSize: 9, color: '#6b7280' },
  tableHeader: { bold: true, fontSize: 10, fillColor: '#f3f4f6' },
  tableCell: { fontSize: 10 },
  code: { font: 'Courier', fontSize: 10, color: '#374151' },
  quote: { italics: true, color: '#374151', margin: [12, 4, 0, 8] },
};

interface RenderInput {
  readonly subject: string;
  readonly bodyMarkdown: string;
  readonly headerLine?: string;
  readonly footer?: {
    readonly documentHash?: string | null;
    readonly anchorTxHash?: string | null;
    readonly generatedAt?: string;
  };
}

export async function renderMarkdownPdf(input: RenderInput): Promise<Buffer> {
  const lex = await getLexer();
  const tokens = lex(input.bodyMarkdown ?? '');
  const content: Content[] = [
    { text: input.subject, style: 'h1' },
    ...tokens.flatMap(tokenToContent),
  ];

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'LETTER',
    pageMargins: [54, 64, 54, 70],
    defaultStyle: { font: 'Helvetica', fontSize: 11, lineHeight: 1.35 },
    styles: STYLES,
    header: input.headerLine
      ? {
          text: input.headerLine,
          alignment: 'right',
          margin: [54, 24, 54, 0],
          style: 'small',
        }
      : undefined,
    footer: (currentPage: number, pageCount: number) => {
      const lines: string[] = [];
      if (input.footer?.generatedAt) {
        lines.push(`Generated ${input.footer.generatedAt}`);
      }
      if (input.footer?.documentHash) {
        lines.push(`SHA-256 ${input.footer.documentHash}`);
      }
      if (input.footer?.anchorTxHash) {
        lines.push(`On-chain ${input.footer.anchorTxHash}`);
      }
      lines.push(`Page ${currentPage} of ${pageCount}`);
      return {
        margin: [54, 16, 54, 0],
        style: 'small',
        text: lines.join(' · '),
        alignment: 'left',
      };
    },
    content,
  };

  return createPdfBuffer(docDefinition);
}

function tokenToContent(token: Token): Content[] {
  switch (token.type) {
    case 'heading': {
      const t = token as Tokens.Heading;
      const style = t.depth === 1 ? 'h1' : t.depth === 2 ? 'h2' : 'h3';
      return [{ text: stripInline(t.text), style }];
    }
    case 'paragraph': {
      const t = token as Tokens.Paragraph;
      return [{ text: renderInline(t.tokens ?? []), style: 'paragraph' }];
    }
    case 'list': {
      const t = token as Tokens.List;
      const items = t.items.map((item) => ({
        text: renderInline(item.tokens ?? []),
        style: 'paragraph',
      }));
      return [t.ordered ? { ol: items } : { ul: items }];
    }
    case 'table': {
      const t = token as Tokens.Table;
      const headerRow = t.header.map((cell) => ({
        text: stripInline(cell.text),
        style: 'tableHeader',
      }));
      const bodyRows = t.rows.map((row) =>
        row.map((cell) => ({
          text: stripInline(cell.text),
          style: 'tableCell',
        })),
      );
      return [
        {
          margin: [0, 4, 0, 12],
          table: {
            headerRows: 1,
            widths: t.header.map(() => '*'),
            body: [headerRow, ...bodyRows],
          },
          layout: 'lightHorizontalLines',
        },
      ];
    }
    case 'code': {
      const t = token as Tokens.Code;
      return [{ text: t.text, style: 'code', margin: [0, 0, 0, 8] }];
    }
    case 'blockquote': {
      const t = token as Tokens.Blockquote;
      return [{ text: stripInline(t.text), style: 'quote' }];
    }
    case 'hr':
      return [
        {
          margin: [0, 8, 0, 8],
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 504,
              y2: 0,
              lineWidth: 0.5,
              lineColor: '#d1d5db',
            },
          ],
        },
      ];
    case 'space':
      return [{ text: '', style: 'paragraph' }];
    default:
      // anything else: render as plain text if it has one
      if (
        'text' in token &&
        typeof (token as { text?: string }).text === 'string'
      ) {
        return [
          {
            text: stripInline((token as { text: string }).text),
            style: 'paragraph',
          },
        ];
      }
      return [];
  }
}

interface InlineRun {
  text: string;
  bold?: boolean;
  italics?: boolean;
}

function renderInline(tokens: readonly Token[]): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const tk of tokens) {
    if (tk.type === 'strong') {
      runs.push({ text: stripInline((tk as Tokens.Strong).text), bold: true });
    } else if (tk.type === 'em') {
      runs.push({ text: stripInline((tk as Tokens.Em).text), italics: true });
    } else if (tk.type === 'codespan') {
      runs.push({ text: (tk as Tokens.Codespan).text });
    } else if (tk.type === 'link') {
      runs.push({ text: stripInline((tk as Tokens.Link).text) });
    } else if (tk.type === 'br') {
      runs.push({ text: '\n' });
    } else if ('text' in tk) {
      runs.push({ text: stripInline((tk as { text: string }).text) });
    }
  }
  if (runs.length === 0) return [{ text: '' }];
  return runs;
}

function stripInline(text: string): string {
  // marked sometimes returns text containing escaped HTML entities; decode the
  // common ones so the PDF doesn't show "&amp;" etc.
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}
