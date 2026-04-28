import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { CapitalCallsService } from './capital-calls.service';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';

@Controller('admin/funds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class CapitalCallsFundController {
  constructor(private readonly capitalCallsService: CapitalCallsService) {}

  @Post(':fundId/capital-calls')
  async create(
    @Param('fundId') fundId: string,
    @Body()
    body: {
      amountDue: string;
      currency?: string;
      dueDate: string;
      wireInstructions?: string;
      createdBy?: string;
    },
  ) {
    const data = await this.capitalCallsService.createCapitalCall(fundId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Get(':fundId/capital-calls')
  async list(@Param('fundId') fundId: string) {
    const data = await this.capitalCallsService.listCapitalCalls(fundId);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}

@Controller('admin/capital-calls')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class CapitalCallsController {
  constructor(private readonly capitalCallsService: CapitalCallsService) {}

  @Put(':callId/status')
  async updateStatus(
    @Param('callId') callId: string,
    @Body() body: { status: string },
  ) {
    const data = await this.capitalCallsService.updateStatus(
      callId,
      body.status,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post(':callId/responses')
  async recordResponse(
    @Param('callId') callId: string,
    @Body()
    body: {
      investorId: string;
      amountReceived: string;
      currency?: string;
      wireDocumentId?: string;
      receivedAt: string;
    },
  ) {
    const data = await this.capitalCallsService.recordResponse(callId, body);
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
