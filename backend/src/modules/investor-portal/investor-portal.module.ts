import { Module } from '@nestjs/common';
import { InvestorPortalController } from './investor-portal.controller';
import { InvestorPortalService } from './investor-portal.service';
import { SignatureVerificationService } from './signature-verification.service';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [DocumentsModule],
  controllers: [InvestorPortalController],
  providers: [InvestorPortalService, SignatureVerificationService],
  exports: [InvestorPortalService],
})
export class InvestorPortalModule {}
