import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ServiceTokenOrAdminGuard } from '../../common/guards/service-token-or-admin.guard';
import { ViemClientProvider } from '../../adapters/blockchain/viem-client.provider';

@Module({
  controllers: [JobsController],
  providers: [JobsService, ServiceTokenOrAdminGuard, ViemClientProvider],
  exports: [JobsService],
})
export class JobsModule {}
