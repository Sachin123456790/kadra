import { Injectable } from '@nestjs/common';
import { DocumentStorageAdapter } from './storage.adapter';
import {
  ExternalDependencyError,
  NotFoundError,
} from '../../common/errors';

@Injectable()
export class SupabaseStorageAdapter implements DocumentStorageAdapter {
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly bucket: string;

  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL ?? '';
    this.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'documents';
  }

  async save(key: string, data: Buffer, mimeType: string): Promise<void> {
    const url = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(data),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ExternalDependencyError(
        'SupabaseStorage',
        `Upload failed (${response.status}): ${body}`,
      );
    }
  }

  async read(key: string): Promise<Buffer> {
    const url = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${key}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
      },
    });

    if (response.status === 404) {
      throw new NotFoundError('Document', key);
    }

    if (!response.ok) {
      throw new ExternalDependencyError(
        'SupabaseStorage',
        `Download failed (${response.status})`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async exists(key: string): Promise<boolean> {
    const url = `${this.supabaseUrl}/storage/v1/object/${this.bucket}/${key}`;
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
      },
    });

    return response.status === 200;
  }
}
