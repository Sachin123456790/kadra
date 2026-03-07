import { SupabaseStorageAdapter } from '../supabase-storage.adapter';
import { ExternalDependencyError, NotFoundError } from '../../../common/errors';

describe('SupabaseStorageAdapter', () => {
  let adapter: SupabaseStorageAdapter;
  let fetchSpy: jest.SpyInstance;

  const SUPABASE_URL = 'https://test-project.supabase.co';
  const SERVICE_ROLE_KEY = 'test-service-role-key';
  const BUCKET = 'test-bucket';

  beforeEach(() => {
    process.env.SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
    process.env.SUPABASE_STORAGE_BUCKET = BUCKET;
    adapter = new SupabaseStorageAdapter();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_STORAGE_BUCKET;
  });

  describe('save', () => {
    it('calls fetch with correct URL, headers, and body', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const key = 'funds/abc/doc.pdf';
      const data = Buffer.from('pdf-content');
      const mimeType = 'application/pdf';

      await adapter.save(key, data, mimeType);

      expect(fetchSpy).toHaveBeenCalledWith(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': mimeType,
            'x-upsert': 'true',
          },
          body: data,
        },
      );
    });

    it('throws ExternalDependencyError on non-2xx response', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as unknown as Response);

      const data = Buffer.from('content');
      await expect(
        adapter.save('key.pdf', data, 'application/pdf'),
      ).rejects.toThrow(ExternalDependencyError);
    });
  });

  describe('read', () => {
    it('returns buffer from fetch response', async () => {
      const content = 'file-content';
      const arrayBuffer = new TextEncoder().encode(content).buffer;

      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => arrayBuffer,
      } as unknown as Response);

      const result = await adapter.read('funds/abc/doc.pdf');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe(content);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/funds/abc/doc.pdf`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
        },
      );
    });

    it('throws NotFoundError on 404', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(adapter.read('missing.pdf')).rejects.toThrow(NotFoundError);
    });

    it('throws ExternalDependencyError on non-404 error', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 503,
      } as Response);

      await expect(adapter.read('key.pdf')).rejects.toThrow(
        ExternalDependencyError,
      );
    });
  });

  describe('exists', () => {
    it('returns true on 200', async () => {
      fetchSpy.mockResolvedValue({
        status: 200,
      } as Response);

      const result = await adapter.exists('funds/abc/doc.pdf');

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/funds/abc/doc.pdf`,
        {
          method: 'HEAD',
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
        },
      );
    });

    it('returns false on 404', async () => {
      fetchSpy.mockResolvedValue({
        status: 404,
      } as Response);

      const result = await adapter.exists('missing.pdf');

      expect(result).toBe(false);
    });
  });
});
