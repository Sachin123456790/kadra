import { SubscriptionStatus, SettlementStatus, TransferRequestStatus, DistributionRunStatus, ExportStatus } from './enums';

type TransitionMap<T extends string> = Partial<Record<T, T[]>>;

function createStateMachine<T extends string>(transitions: TransitionMap<T>) {
  return {
    canTransition(from: T, to: T): boolean {
      return transitions[from]?.includes(to) ?? false;
    },
    assertTransition(from: T, to: T): void {
      if (!this.canTransition(from, to)) {
        throw new Error(`Invalid state transition: ${from} -> ${to}`);
      }
    },
    allowedTransitions(from: T): T[] {
      return transitions[from] ?? [];
    },
  };
}

export const subscriptionStateMachine = createStateMachine<SubscriptionStatus>({
  [SubscriptionStatus.DRAFT]: [SubscriptionStatus.PENDING],
  [SubscriptionStatus.PENDING]: [SubscriptionStatus.SETTLED, SubscriptionStatus.REJECTED],
  [SubscriptionStatus.SETTLED]: [SubscriptionStatus.CLOSED],
});

export const settlementStateMachine = createStateMachine<SettlementStatus>({
  [SettlementStatus.REQUESTED]: [SettlementStatus.VERIFYING],
  [SettlementStatus.VERIFYING]: [SettlementStatus.PASSED, SettlementStatus.FAILED],
});

export const transferStateMachine = createStateMachine<TransferRequestStatus>({
  [TransferRequestStatus.REQUESTED]: [TransferRequestStatus.PRECHECK_FAILED, TransferRequestStatus.SUBMITTED],
  [TransferRequestStatus.SUBMITTED]: [TransferRequestStatus.MINED, TransferRequestStatus.CHAIN_REVERTED],
});

export const distributionRunStateMachine = createStateMachine<DistributionRunStatus>({
  [DistributionRunStatus.QUEUED]: [DistributionRunStatus.RUNNING],
  [DistributionRunStatus.RUNNING]: [DistributionRunStatus.COMPLETED, DistributionRunStatus.FAILED],
});

export const exportStateMachine = createStateMachine<ExportStatus>({
  [ExportStatus.QUEUED]: [ExportStatus.BUILDING],
  [ExportStatus.BUILDING]: [ExportStatus.READY, ExportStatus.FAILED],
  [ExportStatus.READY]: [ExportStatus.EXPIRED],
});
