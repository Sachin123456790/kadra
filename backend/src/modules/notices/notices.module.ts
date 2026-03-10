import { Module } from '@nestjs/common';
import { NoticesAdminController, NoticesInvestorController } from './notices.controller';
import { NoticesService } from './notices.service';

@Module({
  controllers: [NoticesAdminController, NoticesInvestorController],
  providers: [NoticesService],
  exports: [NoticesService],
})
export class NoticesModule {}
