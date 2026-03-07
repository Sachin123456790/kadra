import { Module } from '@nestjs/common';
import { IdentityController, InvestorController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  controllers: [IdentityController, InvestorController],
  providers: [IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
