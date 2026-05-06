import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IdentityService } from './identity.service';
import { BulkImportService } from './bulk-import.service';
import {
  CreateInvestorDto,
  LinkWalletDto,
  UpdateVerificationDto,
} from './identity.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveFundId } from '../../common/resolve-fund-id';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';
import type { AuthenticatedUser } from '../../common/auth/auth.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';

async function extractUploadedFile(
  req: any,
): Promise<{ buffer: Buffer; filename: string; mimetype: string } | null> {
  if (req.file && req.file.buffer) {
    return {
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    };
  }
  if (typeof req.file === 'function') {
    const data = await req.file();
    if (!data) return null;
    return {
      buffer: await data.toBuffer(),
      filename: data.filename,
      mimetype: data.mimetype,
    };
  }
  return null;
}

@Controller('admin/funds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class IdentityController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':fundId/investors')
  async listInvestors(
    @Param('fundId') fundIdOrCode: string,
    @Query('eligibilityStatus') eligibilityStatus?: string,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('search') search?: string,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.identityService.listInvestors(fundId, {
      eligibilityStatus,
      verificationStatus,
      search,
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

  @Get(':fundId/investors/:investorId')
  async getInvestorDetail(
    @Param('fundId') fundIdOrCode: string,
    @Param('investorId') investorId: string,
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.identityService.getInvestorDetail(
      investorId,
      fundId,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Put(':fundId/eligibility')
  async updateEligibility(
    @Param('fundId') fundIdOrCode: string,
    @Body()
    body: {
      investorId: string;
      walletId: string;
      status: string;
      reason?: string;
    },
  ) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);
    const data = await this.identityService.upsertEligibility(fundId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}

@Controller('admin/investors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class InvestorController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly bulkImportService: BulkImportService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('bulk-import')
  async bulkImport(
    @Query('fundId') fundIdOrCode: string | undefined,
    @Req() req: any,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const file = await extractUploadedFile(req);
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const fundId = await resolveFundId(
      this.prisma,
      fundIdOrCode || 'ANGAINOR-DEMO-001',
    );
    const data = await this.bulkImportService.importInvestors(
      fundId,
      file.buffer,
      user?.email,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

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

  @Post(':investorId/wallets/auto-generate')
  async autoGenerateWallet(
    @Param('investorId') investorId: string,
    @Body() body: { chainId?: number; label?: string } = {},
  ) {
    const data = await this.identityService.autoGenerateWallet(investorId, {
      chainId: body.chainId,
      label: body.label,
    });
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Put(':investorId/verification')
  async updateVerification(
    @Param('investorId') investorId: string,
    @Body() body: UpdateVerificationDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const data = await this.identityService.updateVerification(
      investorId,
      body,
      user?.id,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
