import { subscriptionStateMachine, settlementStateMachine, transferStateMachine } from '../state-machines';
import { SubscriptionStatus, SettlementStatus, TransferRequestStatus } from '../enums';

describe('SubscriptionStateMachine', () => {
  it('allows DRAFT -> PENDING', () => {
    expect(subscriptionStateMachine.canTransition(SubscriptionStatus.DRAFT, SubscriptionStatus.PENDING)).toBe(true);
  });

  it('allows PENDING -> SETTLED', () => {
    expect(subscriptionStateMachine.canTransition(SubscriptionStatus.PENDING, SubscriptionStatus.SETTLED)).toBe(true);
  });

  it('blocks DRAFT -> SETTLED', () => {
    expect(subscriptionStateMachine.canTransition(SubscriptionStatus.DRAFT, SubscriptionStatus.SETTLED)).toBe(false);
  });

  it('throws on invalid transition via assert', () => {
    expect(() => subscriptionStateMachine.assertTransition(SubscriptionStatus.SETTLED, SubscriptionStatus.PENDING)).toThrow('Invalid state transition');
  });
});

describe('SettlementStateMachine', () => {
  it('allows REQUESTED -> VERIFYING', () => {
    expect(settlementStateMachine.canTransition(SettlementStatus.REQUESTED, SettlementStatus.VERIFYING)).toBe(true);
  });

  it('allows VERIFYING -> PASSED', () => {
    expect(settlementStateMachine.canTransition(SettlementStatus.VERIFYING, SettlementStatus.PASSED)).toBe(true);
  });

  it('blocks REQUESTED -> PASSED directly', () => {
    expect(settlementStateMachine.canTransition(SettlementStatus.REQUESTED, SettlementStatus.PASSED)).toBe(false);
  });
});

describe('TransferStateMachine', () => {
  it('allows REQUESTED -> PRECHECK_FAILED', () => {
    expect(transferStateMachine.canTransition(TransferRequestStatus.REQUESTED, TransferRequestStatus.PRECHECK_FAILED)).toBe(true);
  });

  it('allows SUBMITTED -> MINED', () => {
    expect(transferStateMachine.canTransition(TransferRequestStatus.SUBMITTED, TransferRequestStatus.MINED)).toBe(true);
  });

  it('blocks MINED -> REQUESTED', () => {
    expect(transferStateMachine.canTransition(TransferRequestStatus.MINED, TransferRequestStatus.REQUESTED)).toBe(false);
  });
});
