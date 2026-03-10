import { NoticesService } from '../notices.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventLogService } from '../../../common/event-log.service';
import { NotFoundError } from '../../../common/errors';

const mockPrisma = () => ({
  notice: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  noticeDelivery: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  investor: {
    findFirst: jest.fn(),
  },
});

const mockEventLog = () => ({
  log: jest.fn().mockResolvedValue(undefined),
});

describe('NoticesService', () => {
  let service: NoticesService;
  let prisma: ReturnType<typeof mockPrisma>;
  let eventLog: ReturnType<typeof mockEventLog>;

  const fundId = 'fund-1';
  const investorId = 'inv-1';
  const noticeId = 'notice-1';
  const deliveryId = 'delivery-1';

  const mockNotice = {
    id: noticeId,
    fundId,
    type: 'CAPITAL_CALL',
    recipientInvestorId: investorId,
    capitalCallId: 'cc-1',
    distributionRunId: null,
    documentHash: 'abc123',
    anchorTxHash: '0xdef456',
    generatedAt: new Date('2026-03-09T00:00:00Z'),
    createdAt: new Date('2026-03-09T00:00:00Z'),
    updatedAt: new Date('2026-03-09T00:00:00Z'),
    deletedAt: null,
  };

  const mockDelivery = {
    id: deliveryId,
    noticeId,
    status: 'GENERATED',
    sentAt: null,
    openedAt: null,
    downloadedAt: null,
    createdAt: new Date('2026-03-09T00:00:00Z'),
    updatedAt: new Date('2026-03-09T00:00:00Z'),
  };

  beforeEach(() => {
    prisma = mockPrisma();
    eventLog = mockEventLog();
    service = new NoticesService(
      prisma as unknown as PrismaService,
      eventLog as unknown as EventLogService,
    );
  });

  describe('generateNotice', () => {
    it('creates notice + delivery record + logs event', async () => {
      const input = {
        fundId,
        type: 'CAPITAL_CALL',
        recipientInvestorId: investorId,
        capitalCallId: 'cc-1',
        documentHash: 'abc123',
        anchorTxHash: '0xdef456',
      };

      const createdNotice = { ...mockNotice, deliveries: [mockDelivery] };
      prisma.notice.create.mockResolvedValue(createdNotice);

      const result = await service.generateNotice(input);

      expect(prisma.notice.create).toHaveBeenCalledWith({
        data: {
          fundId: input.fundId,
          type: input.type,
          recipientInvestorId: input.recipientInvestorId,
          capitalCallId: input.capitalCallId,
          distributionRunId: undefined,
          documentHash: input.documentHash,
          anchorTxHash: input.anchorTxHash,
          deliveries: {
            create: { status: 'GENERATED' },
          },
        },
        include: { deliveries: true },
      });

      expect(eventLog.log).toHaveBeenCalledWith({
        eventType: 'NOTICE_GENERATED',
        aggregateType: 'NOTICE',
        aggregateId: noticeId,
        fundId: input.fundId,
        payload: {
          type: input.type,
          recipientInvestorId: input.recipientInvestorId,
        },
      });

      expect(result).toEqual(createdNotice);
    });
  });

  describe('listNotices', () => {
    it('returns notices with deliveries for fund', async () => {
      const notices = [
        {
          ...mockNotice,
          deliveries: [mockDelivery],
          investor: { id: investorId, legalName: 'Alpine Capital' },
        },
      ];
      prisma.notice.findMany.mockResolvedValue(notices);

      const result = await service.listNotices(fundId);

      expect(prisma.notice.findMany).toHaveBeenCalledWith({
        where: { fundId, deletedAt: null },
        include: {
          deliveries: true,
          investor: { select: { id: true, legalName: true, email: true } },
        },
        orderBy: { generatedAt: 'desc' },
      });

      expect(result).toEqual(notices);
    });
  });

  describe('listInvestorNotices', () => {
    it('filters notices by investor email', async () => {
      const investorEmail = 'alpine@example.com';
      const investor = { id: investorId, email: investorEmail };
      prisma.investor.findFirst.mockResolvedValue(investor);

      const notices = [
        { ...mockNotice, deliveries: [mockDelivery] },
      ];
      prisma.notice.findMany.mockResolvedValue(notices);

      const result = await service.listInvestorNotices(investorEmail);

      expect(prisma.investor.findFirst).toHaveBeenCalledWith({
        where: { email: investorEmail, deletedAt: null },
        select: { id: true },
      });

      expect(prisma.notice.findMany).toHaveBeenCalledWith({
        where: { recipientInvestorId: investorId, deletedAt: null },
        include: { deliveries: true },
        orderBy: { generatedAt: 'desc' },
      });

      expect(result).toEqual(notices);
    });

    it('throws NotFoundError when investor not found', async () => {
      prisma.investor.findFirst.mockResolvedValue(null);

      await expect(
        service.listInvestorNotices('unknown@example.com'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateDeliveryStatus', () => {
    it('sets sentAt when status is SENT', async () => {
      prisma.noticeDelivery.findUnique.mockResolvedValue(mockDelivery);
      prisma.noticeDelivery.update.mockResolvedValue({
        ...mockDelivery,
        status: 'SENT',
        sentAt: new Date(),
      });

      const result = await service.updateDeliveryStatus(deliveryId, 'SENT');

      expect(prisma.noticeDelivery.update).toHaveBeenCalledWith({
        where: { id: deliveryId },
        data: expect.objectContaining({
          status: 'SENT',
          sentAt: expect.any(Date),
        }),
      });

      expect(result.status).toBe('SENT');
    });

    it('sets openedAt when status is VIEWED', async () => {
      prisma.noticeDelivery.findUnique.mockResolvedValue(mockDelivery);
      prisma.noticeDelivery.update.mockResolvedValue({
        ...mockDelivery,
        status: 'VIEWED',
        openedAt: new Date(),
      });

      const result = await service.updateDeliveryStatus(deliveryId, 'VIEWED');

      expect(prisma.noticeDelivery.update).toHaveBeenCalledWith({
        where: { id: deliveryId },
        data: expect.objectContaining({
          status: 'VIEWED',
          openedAt: expect.any(Date),
        }),
      });

      expect(result.status).toBe('VIEWED');
    });

    it('sets downloadedAt when status is DOWNLOADED', async () => {
      prisma.noticeDelivery.findUnique.mockResolvedValue(mockDelivery);
      prisma.noticeDelivery.update.mockResolvedValue({
        ...mockDelivery,
        status: 'DOWNLOADED',
        downloadedAt: new Date(),
      });

      const result = await service.updateDeliveryStatus(deliveryId, 'DOWNLOADED');

      expect(prisma.noticeDelivery.update).toHaveBeenCalledWith({
        where: { id: deliveryId },
        data: expect.objectContaining({
          status: 'DOWNLOADED',
          downloadedAt: expect.any(Date),
        }),
      });

      expect(result.status).toBe('DOWNLOADED');
    });

    it('throws NotFoundError when delivery not found', async () => {
      prisma.noticeDelivery.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDeliveryStatus('nonexistent', 'SENT'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getNotice', () => {
    it('returns notice with deliveries', async () => {
      const notice = {
        ...mockNotice,
        deliveries: [mockDelivery],
        investor: { id: investorId, legalName: 'Alpine Capital', email: 'alpine@example.com' },
      };
      prisma.notice.findUnique.mockResolvedValue(notice);

      const result = await service.getNotice(noticeId);

      expect(prisma.notice.findUnique).toHaveBeenCalledWith({
        where: { id: noticeId },
        include: {
          deliveries: true,
          investor: { select: { id: true, legalName: true, email: true } },
        },
      });

      expect(result).toEqual(notice);
    });

    it('throws NotFoundError for missing notice', async () => {
      prisma.notice.findUnique.mockResolvedValue(null);

      await expect(service.getNotice('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
