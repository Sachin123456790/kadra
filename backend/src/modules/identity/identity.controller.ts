import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { CreateInvestorDto, LinkWalletDto } from './identity.dto';
import { randomUUID } from 'crypto';

@Controller('admin/funds')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Get(':fundId/investors')
  async listInvestors(
    @Param('fundId') fundId: string,
    @Query('eligibilityStatus') eligibilityStatus?: string,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.identityService.listInvestors(fundId, { eligibilityStatus, verificationStatus, search });
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString(), count: data.length },
    };
  }

  @Put(':fundId/eligibility')
  async updateEligibility(
    @Param('fundId') fundId: string,
    @Body() body: { investorId: string; walletId: string; status: string; reason?: string },
  ) {
    const data = await this.identityService.upsertEligibility(fundId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}

@Controller('admin/investors')
export class InvestorController {
  constructor(private readonly identityService: IdentityService) {}

  @Post()
  async createInvestor(@Body() body: CreateInvestorDto) {
    const data = await this.identityService.createInvestor(body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post(':investorId/wallets')
  async linkWallet(
    @Param('investorId') investorId: string,
    @Body() body: LinkWalletDto,
  ) {
    const data = await this.identityService.linkWallet(investorId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
