export interface HashProvider {
  hash(data: Buffer): string;
}

export const HASH_PROVIDER = 'HASH_PROVIDER';
