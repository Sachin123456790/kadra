import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ServiceTokenGuard } from '../../common/guards/service-token.guard';
import { ViemClientProvider } from '../../adapters/blockchain/viem-client.provider';

@Module({
  controllers: [JobsController],
  providers: [JobsService, ServiceTokenGuard, ViemClientProvider],
  exports: [JobsService],
})
export class JobsModule {}
