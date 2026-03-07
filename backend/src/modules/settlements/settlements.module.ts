import { Module } from '@nestjs/common';
import { SettlementsController, SettlementOverrideController } from './settlements.controller';
import { SettlementsService } from './settlements.service';

@Module({
  controllers: [SettlementsController, SettlementOverrideController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
