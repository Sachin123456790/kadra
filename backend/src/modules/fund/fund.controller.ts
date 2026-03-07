import { Controller, Get, Param } from '@nestjs/common';
import { FundService } from './fund.service';
import { randomUUID } from 'crypto';

@Controller('admin/funds')
export class FundController {
  constructor(private readonly fundService: FundService) {}

  @Get(':fundId/overview')
  async getOverview(@Param('fundId') fundId: string) {
    const data = await this.fundService.getFundOverview(fundId);
    return { data, meta: { requestId: randomUUID(), timestamp: new Date().toISOString() } };
  }
}
