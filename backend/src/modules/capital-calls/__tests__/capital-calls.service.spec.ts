import { CapitalCallsService } from '../capital-calls.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventLogService } from '../../../common/event-log.service';
import { NotFoundError } from '../../../common/errors';

const mockPrisma = () => ({
  fund: { findFirst: jest.fn(), findUnique: jest.fn() },
  capitalCall: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  capitalCallResponse: {
    create: jest.fn(),
  },
});

describe('CapitalCallsService', () => {
  let service: CapitalCallsService;
  let prisma: ReturnType<typeof mockPrisma>;
  let eventLog: { log: jest.Mock };

  const fundId = 'fund-1';
  const callId = 'call-1';

  beforeEach(() => {
    prisma = mockPrisma();
    eventLog = { log: jest.fn().mockResolvedValue({}) };
    service = new CapitalCallsService(
      prisma as unknown as PrismaService,
      eventLog as unknown as EventLogService,
    );
  });

  describe('createCapitalCall', () => {
    it('creates a capital call with auto-incremented callNumber and logs event', async () => {
      prisma.fund.findFirst.mockResolvedValue({ id: fundId });
      prisma.capitalCall.count.mockResolvedValue(3);
      const createdCall = {
        id: callId,
        fundId,
        callNumber: 4,
        amountDue: '1000000.00',
        currency: 'USD',
        dueDate: new Date('2026-04-01'),
        wireInstructions: 'Wire to account XYZ',
        status: 'ISSUED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.capitalCall.create.mockResolvedValue(createdCall);

      const result = await service.createCapitalCall(fundId, {
        amountDue: '1000000.00',
        currency: 'USD',
        dueDate: '2026-04-01',
        wireInstructions: 'Wire to account XYZ',
      });

      expect(result).toEqual(createdCall);
      expect(prisma.capitalCall.count).toHaveBeenCalledWith({
        where: { fundId },
      });
      expect(prisma.capitalCall.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fundId,
          callNumber: 4,
          amountDue: '1000000.00',
          currency: 'USD',
          wireInstructions: 'Wire to account XYZ',
          status: 'ISSUED',
        }),
      });
      expect(eventLog.log).toHaveBeenCalledWith({
        eventType: 'CAPITAL_CALL_ISSUED',
        aggregateType: 'CAPITAL_CALL',
        aggregateId: callId,
        fundId,
        payload: expect.objectContaining({
          callNumber: 4,
          amountDue: '1000000.00',
        }),
      });
    });

    it('throws NotFoundError for nonexistent fund', async () => {
      prisma.fund.findFirst.mockResolvedValue(null);

      await expect(
        service.createCapitalCall('nonexistent-code', {
          amountDue: '500000',
          currency: 'USD',
          dueDate: '2026-04-01',
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listCapitalCalls', () => {
    it('returns capital calls for fund ordered by createdAt desc', async () => {
      prisma.fund.findFirst.mockResolvedValue({ id: fundId });
      const calls = [
        {
          id: 'call-2',
          fundId,
          callNumber: 2,
          status: 'ISSUED',
          createdAt: new Date('2026-03-02'),
          responses: [],
        },
        {
          id: 'call-1',
          fundId,
          callNumber: 1,
          status: 'CLOSED',
          createdAt: new Date('2026-03-01'),
          responses: [],
        },
      ];
      prisma.capitalCall.findMany.mockResolvedValue(calls);

      const result = await service.listCapitalCalls(fundId);

      expect(result).toEqual(calls);
      expect(prisma.capitalCall.findMany).toHaveBeenCalledWith({
        where: { fundId },
        include: { responses: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('recordResponse', () => {
    it('records payment response and logs event', async () => {
      const call = {
        id: callId,
        fundId,
        callNumber: 1,
        status: 'ISSUED',
      };
      prisma.capitalCall.findUnique.mockResolvedValue(call);
      const response = {
        id: 'resp-1',
        capitalCallId: callId,
        investorId: 'inv-1',
        amountReceived: '200000.00',
        currency: 'USD',
        wireDocumentId: 'doc-1',
        status: 'RECEIVED',
        receivedAt: new Date('2026-03-09'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.capitalCallResponse.create.mockResolvedValue(response);

      const result = await service.recordResponse(callId, {
        investorId: 'inv-1',
        amountReceived: '200000.00',
        currency: 'USD',
        wireDocumentId: 'doc-1',
        receivedAt: '2026-03-09',
      });

      expect(result).toEqual(response);
      expect(prisma.capitalCallResponse.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          capitalCallId: callId,
          investorId: 'inv-1',
          amountReceived: '200000.00',
          currency: 'USD',
          wireDocumentId: 'doc-1',
          status: 'RECEIVED',
        }),
      });
      expect(eventLog.log).toHaveBeenCalledWith({
        eventType: 'CAPITAL_CALL_RESPONSE_RECORDED',
        aggregateType: 'CAPITAL_CALL',
        aggregateId: callId,
        fundId,
        payload: expect.objectContaining({
          responseId: 'resp-1',
          investorId: 'inv-1',
          amountReceived: '200000.00',
        }),
      });
    });
  });

  describe('updateStatus', () => {
    it('updates capital call status and logs event', async () => {
      const call = {
        id: callId,
        fundId,
        callNumber: 1,
        status: 'ISSUED',
      };
      prisma.capitalCall.findUnique.mockResolvedValue(call);
      const updated = { ...call, status: 'CLOSED' };
      prisma.capitalCall.update.mockResolvedValue(updated);

      const result = await service.updateStatus(callId, 'CLOSED');

      expect(result).toEqual(updated);
      expect(prisma.capitalCall.update).toHaveBeenCalledWith({
        where: { id: callId },
        data: { status: 'CLOSED' },
      });
      expect(eventLog.log).toHaveBeenCalledWith({
        eventType: 'CAPITAL_CALL_STATUS_UPDATED',
        aggregateType: 'CAPITAL_CALL',
        aggregateId: callId,
        fundId,
        payload: expect.objectContaining({
          previousStatus: 'ISSUED',
          newStatus: 'CLOSED',
        }),
      });
    });
  });
});
