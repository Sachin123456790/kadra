import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventLogService } from '../../common/event-log.service';
import { NotFoundError } from '../../common/errors';
import { resolveFundId } from '../../common/resolve-fund-id';

interface CreateCapitalCallInput {
  amountDue: string;
  currency?: string;
  dueDate: string;
  wireInstructions?: string;
  createdBy?: string;
}

interface RecordResponseInput {
  investorId: string;
  amountReceived: string;
  currency?: string;
  wireDocumentId?: string;
  receivedAt: string;
}

@Injectable()
export class CapitalCallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
  ) {}

  async createCapitalCall(fundIdOrCode: string, input: CreateCapitalCallInput) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);

    const existingCount = await this.prisma.capitalCall.count({
      where: { fundId },
    });
    const callNumber = existingCount + 1;

    const call = await this.prisma.capitalCall.create({
      data: {
        fundId,
        callNumber,
        amountDue: input.amountDue,
        currency: input.currency ?? 'USD',
        dueDate: new Date(input.dueDate),
        wireInstructions: input.wireInstructions ?? null,
        status: 'ISSUED',
        createdBy: input.createdBy ?? null,
      },
    });

    await this.eventLog.log({
      eventType: 'CAPITAL_CALL_ISSUED',
      aggregateType: 'CAPITAL_CALL',
      aggregateId: call.id,
      fundId,
      payload: {
        callNumber,
        amountDue: input.amountDue,
        currency: input.currency ?? 'USD',
        dueDate: input.dueDate,
      },
    });

    return call;
  }

  async listCapitalCalls(fundIdOrCode: string) {
    const fundId = await resolveFundId(this.prisma, fundIdOrCode);

    return this.prisma.capitalCall.findMany({
      where: { fundId },
      include: { responses: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCapitalCall(callId: string) {
    const call = await this.prisma.capitalCall.findUnique({
      where: { id: callId },
      include: { responses: true, fund: true },
    });
    if (!call) throw new NotFoundError('CapitalCall', callId);
    return call;
  }

  async updateStatus(callId: string, status: string) {
    const call = await this.prisma.capitalCall.findUnique({
      where: { id: callId },
    });
    if (!call) throw new NotFoundError('CapitalCall', callId);

    const previousStatus = call.status;
    const updated = await this.prisma.capitalCall.update({
      where: { id: callId },
      data: { status },
    });

    await this.eventLog.log({
      eventType: 'CAPITAL_CALL_STATUS_UPDATED',
      aggregateType: 'CAPITAL_CALL',
      aggregateId: callId,
      fundId: call.fundId,
      payload: {
        previousStatus,
        newStatus: status,
      },
    });

    return updated;
  }

  async recordResponse(callId: string, input: RecordResponseInput) {
    const call = await this.prisma.capitalCall.findUnique({
      where: { id: callId },
    });
    if (!call) throw new NotFoundError('CapitalCall', callId);

    const response = await this.prisma.capitalCallResponse.create({
      data: {
        capitalCallId: callId,
        investorId: input.investorId,
        amountReceived: input.amountReceived,
        currency: input.currency ?? 'USD',
        wireDocumentId: input.wireDocumentId ?? null,
        status: 'RECEIVED',
        receivedAt: new Date(input.receivedAt),
      },
    });

    await this.eventLog.log({
      eventType: 'CAPITAL_CALL_RESPONSE_RECORDED',
      aggregateType: 'CAPITAL_CALL',
      aggregateId: callId,
      fundId: call.fundId,
      payload: {
        responseId: response.id,
        investorId: input.investorId,
        amountReceived: input.amountReceived,
      },
    });

    return response;
  }
}
