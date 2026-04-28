import { NoticesAdminController } from '../notices.controller';
import { NoticesService } from '../notices.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockPrisma = () => ({
  fund: {
    findFirst: jest.fn(),
  },
});

const mockNoticesService = () => ({
  generateNotice: jest.fn(),
  listNotices: jest.fn(),
  updateDeliveryStatus: jest.fn(),
});

describe('NoticesAdminController', () => {
  let controller: NoticesAdminController;
  let prisma: ReturnType<typeof mockPrisma>;
  let noticesService: ReturnType<typeof mockNoticesService>;

  beforeEach(() => {
    prisma = mockPrisma();
    noticesService = mockNoticesService();
    controller = new NoticesAdminController(
      noticesService as unknown as NoticesService,
      prisma as unknown as PrismaService,
    );
  });

  it('resolves fund code before generating a notice', async () => {
    prisma.fund.findFirst.mockResolvedValue({ id: 'fund-uuid-1' });
    noticesService.generateNotice.mockResolvedValue({ id: 'notice-1' });

    const result = await controller.generateNotice({
      fundId: 'ANGAINOR-DEMO-001',
      type: 'TRANSFER',
      recipientInvestorId: 'investor-1',
    });

    expect(prisma.fund.findFirst).toHaveBeenCalledWith({
      where: { code: 'ANGAINOR-DEMO-001', deletedAt: null },
      select: { id: true },
    });
    expect(noticesService.generateNotice).toHaveBeenCalledWith({
      fundId: 'fund-uuid-1',
      type: 'TRANSFER',
      recipientInvestorId: 'investor-1',
    });
    expect(result.data).toEqual({ id: 'notice-1' });
  });
});
