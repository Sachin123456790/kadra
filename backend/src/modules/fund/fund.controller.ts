import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FundService } from './fund.service';
import { CreateFundDto } from './fund.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ADMIN_ROLES } from '../../common/auth/auth.types';
import { Roles } from '../../common/auth/roles.decorator';

@Controller('admin/funds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class FundController {
  constructor(
    private readonly fundService: FundService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async createFund(@Body() body: CreateFundDto) {
    const data = await this.fundService.createFund(body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get(':fundId')
  async getFundDetails(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.fundService.getFundDetails(fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get(':fundId/overview')
  async getOverview(@Param('fundId') fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.fundService.getFundOverview(fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get(':fundId/activity-feed')
  async getActivityFeed(
    @Param('fundId') fundIdOrCode: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.fundService.getActivityFeed(fundId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return {
      data,
      meta: {
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
        count: data.length,
      },
    };
  }
}
