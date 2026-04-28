describe('resolveDocumentParserAdapter', () => {
  const originalProvider = process.env.DOCUMENT_PARSER_PROVIDER;
  const originalGeminiKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.DOCUMENT_PARSER_PROVIDER;
    } else {
      process.env.DOCUMENT_PARSER_PROVIDER = originalProvider;
    }

    if (originalGeminiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }

    jest.resetModules();
  });

  it('defaults to Gemini when a Gemini key is configured', async () => {
    delete process.env.DOCUMENT_PARSER_PROVIDER;
    process.env.GEMINI_API_KEY = 'test-key';

    const { resolveDocumentParserAdapter } = require('../documents.module');
    const adapter = resolveDocumentParserAdapter();

    expect(adapter.constructor.name).toBe('GeminiParserAdapter');
  });

  it('throws when Gemini is explicitly requested without a key', async () => {
    process.env.DOCUMENT_PARSER_PROVIDER = 'gemini';
    delete process.env.GEMINI_API_KEY;

    const { resolveDocumentParserAdapter } = require('../documents.module');

    expect(() => resolveDocumentParserAdapter()).toThrow(
      'DOCUMENT_PARSER_PROVIDER=gemini requires GEMINI_API_KEY',
    );
  });

  it('uses the mock parser when explicitly configured', async () => {
    process.env.DOCUMENT_PARSER_PROVIDER = 'mock';
    process.env.GEMINI_API_KEY = 'test-key';

    const { resolveDocumentParserAdapter } = require('../documents.module');
    const adapter = resolveDocumentParserAdapter();

    expect(adapter.constructor.name).toBe('MockParserAdapter');
  });
});
