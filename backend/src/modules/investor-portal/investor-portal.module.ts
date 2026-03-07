import { Module } from '@nestjs/common';
import { InvestorPortalController } from './investor-portal.controller';
import { InvestorPortalService } from './investor-portal.service';

@Module({
  controllers: [InvestorPortalController],
  providers: [InvestorPortalService],
  exports: [InvestorPortalService],
})
export class InvestorPortalModule {}
