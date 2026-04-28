import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
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
import { FUND_TERMS_REGISTRY_ADAPTER } from '../../adapters/blockchain/viem-fund-terms-registry.adapter';
import { ViemFundTermsRegistryAdapter } from '../../adapters/blockchain/viem-fund-terms-registry.adapter';
import { ViemClientProvider } from '../../adapters/blockchain/viem-client.provider';

export function resolveDocumentParserAdapter() {
  const configuredProvider = process.env.DOCUMENT_PARSER_PROVIDER
    ?.trim()
    .toLowerCase();

  if (configuredProvider === 'gemini' && !process.env.GEMINI_API_KEY) {
    throw new Error(
      'DOCUMENT_PARSER_PROVIDER=gemini requires GEMINI_API_KEY',
    );
  }

  if (configuredProvider === 'mock') {
    return new MockParserAdapter();
  }

  if (configuredProvider === 'gemini' || process.env.GEMINI_API_KEY) {
    return new GeminiParserAdapter();
  }

  return new MockParserAdapter();
}

@Module({
  imports: [SubscriptionsModule],
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
      useFactory: resolveDocumentParserAdapter,
    },
    {
      provide: DOCUMENT_REGISTRY_ADAPTER,
      useClass: ViemDocumentRegistryAdapter,
    },
    {
      provide: FUND_TERMS_REGISTRY_ADAPTER,
      useClass: ViemFundTermsRegistryAdapter,
    },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
