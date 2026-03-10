import { Module } from '@nestjs/common';
import {
  CapitalCallsFundController,
  CapitalCallsController,
} from './capital-calls.controller';
import { CapitalCallsService } from './capital-calls.service';

@Module({
  controllers: [CapitalCallsFundController, CapitalCallsController],
  providers: [CapitalCallsService],
  exports: [CapitalCallsService],
})
export class CapitalCallsModule {}
