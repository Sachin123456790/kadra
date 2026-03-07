import { Module } from '@nestjs/common';
import { InvestorPortalController } from './investor-portal.controller';
import { InvestorPortalService } from './investor-portal.service';
import { SignatureVerificationService } from './signature-verification.service';

@Module({
  controllers: [InvestorPortalController],
  providers: [InvestorPortalService, SignatureVerificationService],
  exports: [InvestorPortalService],
})
export class InvestorPortalModule {}
