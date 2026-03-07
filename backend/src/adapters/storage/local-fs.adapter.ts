import { Injectable } from '@nestjs/common';
import { DocumentStorageAdapter } from './storage.adapter';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class LocalFsStorageAdapter implements DocumentStorageAdapter {
  private readonly basePath = path.join(process.cwd(), 'storage', 'documents');

  async save(key: string, data: Buffer, mimeType: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async read(key: string): Promise<Buffer> {
    const filePath = path.join(this.basePath, key);
    return fs.readFile(filePath);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = path.join(this.basePath, key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
