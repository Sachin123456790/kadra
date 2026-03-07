import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { UploadPaymentEvidenceDto, OverrideSettlementDto } from './settlements.dto';
import { randomUUID } from 'crypto';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ADMIN_ROLES } from '../../common/auth/auth.types';

@Controller('admin/subscriptions')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post(':subscriptionId/payment-validations')
  async requestValidation(
    @Param('subscriptionId') subscriptionId: string,
    @Body()
    body: {
      paymentDocumentId: string;
      declaredAmount: string;
      declaredCurrency: string;
      declaredReference: string;
    },
  ) {
    const data = await this.settlementsService.requestValidation(
      subscriptionId,
      body,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post(':subscriptionId/settlement-confirmation')
  async confirmSettlement(
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { settlementRecordId: string },
  ) {
    const data = await this.settlementsService.confirmSettlement(
      subscriptionId,
      body.settlementRecordId,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }

  @Post(':subscriptionId/payment-evidence')
  async uploadPaymentEvidence(
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: UploadPaymentEvidenceDto,
  ) {
    const data = await this.settlementsService.uploadPaymentEvidence(
      subscriptionId,
      body,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}

@Controller('admin/settlements')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class SettlementOverrideController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post(':settlementRecordId/override')
  async overrideSettlement(
    @Param('settlementRecordId') settlementRecordId: string,
    @Body() body: OverrideSettlementDto,
  ) {
    const data = await this.settlementsService.overrideSettlement(
      settlementRecordId,
      body,
    );
    return {
      data,
      meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
    };
  }
}
