import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('hosted demo isolation', () => {
  it('keeps demo API calls same-origin even when an API override is present', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    vi.stubEnv('VITE_API_URL', 'https://production.example/api');
    vi.resetModules();
    const { API_BASE_URL, DEMO_MODE } = await import('@/config/constants');
    expect(DEMO_MODE).toBe(true);
    expect(API_BASE_URL).toBe('/api/v1');
  });
  it('blocks edits and both upload paths before any network request', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { post, put, upload } = await import('@/services/api-client');
    const { uploadReportingDocument } = await import('@/services/documents.service');
    const file = new File(['do not transmit'], 'private.pdf', { type: 'application/pdf' });
    await expect(post('/admin/funds/example/settlements', {})).rejects.toThrow('read-only demo');
    await expect(put('/admin/documents/example', {})).rejects.toThrow('read-only demo');
    await expect(upload('/admin/documents', file)).rejects.toThrow('read-only demo');
    await expect(uploadReportingDocument('example', file, 'Report', 'Q1')).rejects.toThrow('read-only demo');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('retains the normal backend configuration outside demo builds', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    vi.stubEnv('VITE_API_URL', 'https://backend.example/api/');
    vi.resetModules();
    const { API_BASE_URL, DEMO_MODE } = await import('@/config/constants');
    expect(DEMO_MODE).toBe(false);
    expect(API_BASE_URL).toBe('https://backend.example/api');
  });
});
