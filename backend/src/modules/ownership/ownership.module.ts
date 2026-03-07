import { Module } from '@nestjs/common';
import { OwnershipController, ProjectionController } from './ownership.controller';
import { OwnershipService } from './ownership.service';

@Module({
  controllers: [OwnershipController, ProjectionController],
  providers: [OwnershipService],
  exports: [OwnershipService],
})
export class OwnershipModule {}
