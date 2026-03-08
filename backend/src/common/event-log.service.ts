import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    fundId?: string;
    payload?: Record<string, any>;
    txHash?: string;
    blockNumber?: number;
    correlationId?: string;
  }) {
    return this.prisma.systemEventLog.create({
      data: {
        eventType: params.eventType,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        fundId: params.fundId,
        sourceContext: 'backend-service',
        payloadJson: params.payload ?? {},
        txHash: params.txHash,
        blockNumber: params.blockNumber ? BigInt(params.blockNumber) : undefined,
        correlationId: params.correlationId,
        occurredAt: new Date(),
      },
    });
  }
}
