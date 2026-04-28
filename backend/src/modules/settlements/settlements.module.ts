import { Module } from '@nestjs/common';
import {
  SettlementsController,
  SettlementOverrideController,
} from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { TokenizationModule } from '../tokenization/tokenization.module';
import { STORAGE_ADAPTER } from '../../adapters/storage/storage.adapter';
import { LocalFsStorageAdapter } from '../../adapters/storage/local-fs.adapter';
import { SupabaseStorageAdapter } from '../../adapters/storage/supabase-storage.adapter';

@Module({
  imports: [TokenizationModule],
  controllers: [SettlementsController, SettlementOverrideController],
  providers: [
    SettlementsService,
    {
      provide: STORAGE_ADAPTER,
      useClass: process.env.SUPABASE_URL
        ? SupabaseStorageAdapter
        : LocalFsStorageAdapter,
    },
  ],
  exports: [SettlementsService],
})
export class SettlementsModule {}
