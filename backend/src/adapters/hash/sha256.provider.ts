import { Injectable } from '@nestjs/common';
import { HashProvider } from './hash.provider';
import { createHash } from 'crypto';

@Injectable()
export class Sha256HashProvider implements HashProvider {
  hash(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }
}
