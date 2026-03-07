import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ServiceTokenGuard } from '../../common/guards/service-token.guard';

@Module({
  controllers: [JobsController],
  providers: [JobsService, ServiceTokenGuard],
  exports: [JobsService],
})
export class JobsModule {}
