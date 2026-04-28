import { JobsService } from '../jobs.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotFoundError, ConflictError } from '../../../common/errors';

const mockPrisma = () => ({
  job: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  jobDeadLetter: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  tokenContract: {
    findMany: jest.fn(),
  },
  transferRequest: {
    findMany: jest.fn(),
  },
});

describe('JobsService', () => {
  let service: JobsService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new JobsService(prisma as unknown as PrismaService);
  });

  describe('runPendingJobs', () => {
    it('processes queued jobs and returns summary', async () => {
      const mockJob = {
        id: 'job-1',
        jobType: 'document.parse',
        payload: {},
        status: 'QUEUED',
        priority: 0,
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        scheduledAt: new Date(),
      };

      prisma.job.findMany.mockResolvedValue([mockJob]);
      prisma.job.update.mockResolvedValue({ ...mockJob, status: 'COMPLETED' });

      const result = await service.runPendingJobs(10);

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.deadLettered).toBe(0);
      // First call: set to RUNNING, second call: set to COMPLETED
      expect(prisma.job.update).toHaveBeenCalledTimes(2);
    });

    it('moves failed jobs exceeding maxAttempts to dead letter', async () => {
      const mockJob = {
        id: 'job-2',
        jobType: 'unknown.type',
        payload: { key: 'value' },
        status: 'QUEUED',
        priority: 0,
        attempts: 2, // already at 2, maxAttempts=3, next attempt (3) >= 3
        maxAttempts: 3,
        lastError: null,
        scheduledAt: new Date(),
      };

      prisma.job.findMany.mockResolvedValue([mockJob]);
      prisma.job.update.mockResolvedValue({
        ...mockJob,
        status: 'DEAD_LETTERED',
      });
      prisma.jobDeadLetter.create.mockResolvedValue({
        id: 'dl-1',
        originalJobId: 'job-2',
      });

      const result = await service.runPendingJobs(10);

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.deadLettered).toBe(1);
      expect(prisma.jobDeadLetter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            originalJobId: 'job-2',
            jobType: 'unknown.type',
            payload: { key: 'value' },
            attempts: 3,
          }),
        }),
      );
      expect(prisma.job.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DEAD_LETTERED' }),
        }),
      );
    });

    it('returns zeros for empty queue', async () => {
      prisma.job.findMany.mockResolvedValue([]);

      const result = await service.runPendingJobs(10);

      expect(result).toEqual({
        processed: 0,
        succeeded: 0,
        failed: 0,
        deadLettered: 0,
      });
    });
  });

  describe('runSingleJob', () => {
    it('throws NotFoundError for missing job', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      await expect(service.runSingleJob('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('executes a queued job and returns COMPLETED', async () => {
      const mockJob = {
        id: 'job-3',
        jobType: 'token.mint',
        payload: {},
        status: 'QUEUED',
        attempts: 0,
        maxAttempts: 3,
      };

      prisma.job.findUnique.mockResolvedValue(mockJob);
      prisma.job.update.mockResolvedValue({ ...mockJob, status: 'COMPLETED' });

      const result = await service.runSingleJob('job-3');

      expect(result.jobId).toBe('job-3');
      expect(result.status).toBe('COMPLETED');
      expect(result.error).toBeUndefined();
    });

    it('returns FAILED for unknown job type', async () => {
      const mockJob = {
        id: 'job-4',
        jobType: 'bogus.type',
        payload: {},
        status: 'QUEUED',
        attempts: 0,
        maxAttempts: 3,
      };

      prisma.job.findUnique.mockResolvedValue(mockJob);
      prisma.job.update.mockResolvedValue({ ...mockJob, status: 'FAILED' });

      const result = await service.runSingleJob('job-4');

      expect(result.jobId).toBe('job-4');
      expect(result.status).toBe('FAILED');
      expect(result.error).toContain('Unknown job type');
    });

    it('dead-letters terminal failures instead of returning FAILED forever', async () => {
      const mockJob = {
        id: 'job-5',
        jobType: 'bogus.type',
        payload: {},
        status: 'FAILED',
        attempts: 2,
        maxAttempts: 3,
      };

      prisma.job.findUnique.mockResolvedValue(mockJob);
      prisma.job.update.mockResolvedValue({
        ...mockJob,
        status: 'DEAD_LETTERED',
      });
      prisma.jobDeadLetter.create.mockResolvedValue({
        id: 'dl-5',
        originalJobId: 'job-5',
      });

      const result = await service.runSingleJob('job-5');

      expect(result.status).toBe('DEAD_LETTERED');
      expect(prisma.jobDeadLetter.create).toHaveBeenCalledTimes(1);
      expect(prisma.job.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DEAD_LETTERED' }),
        }),
      );
    });

    it('rejects retrying a FAILED job that already exhausted attempts', async () => {
      prisma.job.findUnique.mockResolvedValue({
        id: 'job-6',
        jobType: 'document.parse',
        payload: {},
        status: 'FAILED',
        attempts: 3,
        maxAttempts: 3,
      });

      await expect(service.runSingleJob('job-6')).rejects.toThrow(
        ConflictError,
      );
    });
  });

  describe('retryDeadLetter', () => {
    it('rejects retrying dead-lettered jobs', async () => {
      const mockDeadLetter = {
        id: 'dl-1',
        originalJobId: 'job-old',
        jobType: 'document.parse',
        payload: { docId: '123' },
        attempts: 3,
        lastError: 'some error',
        failedAt: new Date(),
      };

      prisma.jobDeadLetter.findUnique.mockResolvedValue(mockDeadLetter);

      await expect(service.retryDeadLetter('dl-1')).rejects.toThrow(
        ConflictError,
      );
      expect(prisma.job.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundError for missing dead letter', async () => {
      prisma.jobDeadLetter.findUnique.mockResolvedValue(null);

      await expect(service.retryDeadLetter('nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('ingestChainEvents', () => {
    it('returns stub summary', async () => {
      prisma.tokenContract.findMany.mockResolvedValue([
        { id: 'tc-1', fundId: 'f-1', deploymentStatus: 'DEPLOYED' },
        { id: 'tc-2', fundId: 'f-2', deploymentStatus: 'DEPLOYED' },
      ]);

      const result = await service.ingestChainEvents();

      expect(result.contractsProcessed).toBe(2);
      expect(result.eventsIngested).toBe(0);
    });

    it('filters by fundId when provided', async () => {
      prisma.tokenContract.findMany.mockResolvedValue([
        { id: 'tc-1', fundId: 'f-1', deploymentStatus: 'DEPLOYED' },
      ]);

      const result = await service.ingestChainEvents('f-1');

      expect(result.contractsProcessed).toBe(1);
      expect(prisma.tokenContract.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ fundId: 'f-1' }),
      });
    });
  });

  describe('syncPendingTransactions', () => {
    it('returns stub summary', async () => {
      prisma.transferRequest.findMany.mockResolvedValue([
        { id: 'tr-1', requestStatus: 'SUBMITTED' },
      ]);

      const result = await service.syncPendingTransactions();

      expect(result.checked).toBe(1);
      expect(result.confirmed).toBe(0);
      expect(result.reverted).toBe(0);
    });

    it('returns zeros when no pending transactions', async () => {
      prisma.transferRequest.findMany.mockResolvedValue([]);

      const result = await service.syncPendingTransactions();

      expect(result.checked).toBe(0);
      expect(result.confirmed).toBe(0);
      expect(result.reverted).toBe(0);
    });
  });
});
