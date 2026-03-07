export interface DocumentStorageAdapter {
  save(key: string, data: Buffer, mimeType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
}

export const STORAGE_ADAPTER = 'STORAGE_ADAPTER';
