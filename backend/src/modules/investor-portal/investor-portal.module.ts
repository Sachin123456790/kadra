import { Module } from '@nestjs/common';
import {
  InvestorPortalController,
  AdminReportingDocumentsController,
} from './investor-portal.controller';
import { InvestorPortalService } from './investor-portal.service';
import { SignatureVerificationService } from './signature-verification.service';
import { DocumentsModule } from '../documents/documents.module';
import { DistributionModule } from '../distribution/distribution.module';
import { NoticesModule } from '../notices/notices.module';
import { IdentityModule } from '../identity/identity.module';
import { EventLogModule } from '../../common/event-log.module';

@Module({
  imports: [
    DocumentsModule,
    DistributionModule,
    NoticesModule,
    IdentityModule,
    EventLogModule,
  ],
  controllers: [InvestorPortalController, AdminReportingDocumentsController],
  providers: [InvestorPortalService, SignatureVerificationService],
  exports: [InvestorPortalService],
})
export class InvestorPortalModule {}
