import { get } from './api-client';

export interface CapTableRow {
  investorId: string;
  investorName: string;
  walletAddress: string;
  pendingAllocationPct: number;
  settledTokenBalance: string;
  ownershipPct: number;
}

export interface CapTable {
  fundId: string;
  asOfTimestamp: string;
  rows: CapTableRow[];
}

export interface OwnershipEvent {
  eventId: string;
  eventType: string;
  fromWalletAddress: string;
  toWalletAddress: string;
  tokenDelta: string;
  txHash: string;
  blockNumber: number;
  eventTimestamp: string;
}

export function getCapTable(fundId: string) {
  return get<CapTable>(`/admin/funds/${fundId}/cap-table`);
}

export function getOwnershipHistory(fundId: string) {
  return get<OwnershipEvent[]>(`/admin/funds/${fundId}/ownership-history`);
}
