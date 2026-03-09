import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { STORAGE_ADAPTER } from '../../adapters/storage/storage.adapter';
import { LocalFsStorageAdapter } from '../../adapters/storage/local-fs.adapter';
import { SupabaseStorageAdapter } from '../../adapters/storage/supabase-storage.adapter';
import { HASH_PROVIDER } from '../../adapters/hash/hash.provider';
import { Sha256HashProvider } from '../../adapters/hash/sha256.provider';
import { PARSER_ADAPTER } from '../../adapters/parser/parser.adapter';
import { MockParserAdapter } from '../../adapters/parser/mock-parser.adapter';
import { GeminiParserAdapter } from '../../adapters/parser/gemini-parser.adapter';
import { DOCUMENT_REGISTRY_ADAPTER } from '../../adapters/blockchain/viem-document-registry.adapter';
import { ViemDocumentRegistryAdapter } from '../../adapters/blockchain/viem-document-registry.adapter';
import { ViemClientProvider } from '../../adapters/blockchain/viem-client.provider';

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    ViemClientProvider,
    {
      provide: STORAGE_ADAPTER,
      useClass: process.env.SUPABASE_URL
        ? SupabaseStorageAdapter
        : LocalFsStorageAdapter,
    },
    { provide: HASH_PROVIDER, useClass: Sha256HashProvider },
    {
      provide: PARSER_ADAPTER,
      useClass:
        (process.env.DOCUMENT_PARSER_PROVIDER ?? 'mock').toLowerCase() ===
          'gemini' && !!process.env.GEMINI_API_KEY
          ? GeminiParserAdapter
          : MockParserAdapter,
    },
    {
      provide: DOCUMENT_REGISTRY_ADAPTER,
      useClass: ViemDocumentRegistryAdapter,
    },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
