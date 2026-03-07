import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { FundService } from './fund.service';
import { CreateFundDto } from './fund.dto';
import { randomUUID } from 'crypto';

@Controller('admin/funds')
export class FundController {
  constructor(private readonly fundService: FundService) {}

  @Post()
  async createFund(@Body() body: CreateFundDto) {
    const data = await this.fundService.createFund(body);
    return { data, meta: { requestId: randomUUID(), timestamp: new Date().toISOString() } };
  }

  @Get(':fundId')
  async getFundDetails(@Param('fundId') fundId: string) {
    const data = await this.fundService.getFundDetails(fundId);
    return { data, meta: { requestId: randomUUID(), timestamp: new Date().toISOString() } };
  }

  @Get(':fundId/overview')
  async getOverview(@Param('fundId') fundId: string) {
    const data = await this.fundService.getFundOverview(fundId);
    return { data, meta: { requestId: randomUUID(), timestamp: new Date().toISOString() } };
  }
}
