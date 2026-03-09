import { Module } from '@nestjs/common';
import {
  SettlementsController,
  SettlementOverrideController,
} from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { TokenizationModule } from '../tokenization/tokenization.module';

@Module({
  imports: [TokenizationModule],
  controllers: [SettlementsController, SettlementOverrideController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
