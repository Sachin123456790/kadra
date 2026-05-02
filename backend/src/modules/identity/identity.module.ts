import { Module } from '@nestjs/common';
import { IdentityController, InvestorController } from './identity.controller';
import { IdentityService } from './identity.service';
import { BulkImportService } from './bulk-import.service';

@Module({
  controllers: [IdentityController, InvestorController],
  providers: [IdentityService, BulkImportService],
  exports: [IdentityService, BulkImportService],
})
export class IdentityModule {}
