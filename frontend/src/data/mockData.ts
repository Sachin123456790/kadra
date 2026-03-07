// ============================================================
// MOCK DATA — Replace with API calls when wiring backend
// File: src/data/mockData.ts
// ============================================================

export interface Investor {
  id: string;
  name: string;
  wallet: string;
  verificationStatus: "Verified" | "Pending" | "Revoked";
  fundEligibility: string;
  ownership: number;
}

export interface Subscription {
  id: string;
  ref: string;
  investorId: string;
  investorName: string;
  allocation: number;
  committedAmount: number;
  status: "Pending" | "Settled" | "Rejected";
  lpaHash: string;
  timestamp: string;
}

export interface Transfer {
  id: string;
  fromWallet: string;
  toWallet: string;
  amount: number;
  status: "Success" | "Failed";
  failureReason?: string;
  txHash?: string;
  timestamp: string;
}

export interface CapTableEntry {
  id: string;
  investorName: string;
  wallet: string;
  pendingAllocation: number;
  settledTokenBalance: number;
  ownership: number;
  lastUpdated: string;
}

export interface DistributionEntry {
  id: string;
  investorName: string;
  ownership: number;
  grossAllocation: number;
  tier1: number;
  tier2: number;
  tier3: number;
}

export interface ExportJob {
  id: string;
  type: string;
  requestedAt: string;
  status: "Completed" | "Processing" | "Failed";
  artifact?: string;
}

// --- Investors ---
export const investors: Investor[] = [
  { id: "inv-1", name: "BlackRock Capital Partners", wallet: "0x1a2B...9c4D", verificationStatus: "Verified", fundEligibility: "Qualified Purchaser", ownership: 28.5 },
  { id: "inv-2", name: "Meridian Wealth Holdings", wallet: "0x3e5F...7a1B", verificationStatus: "Verified", fundEligibility: "Accredited Investor", ownership: 18.2 },
  { id: "inv-3", name: "Pacific Rim Advisors LLC", wallet: "0x8d2C...4e6A", verificationStatus: "Verified", fundEligibility: "Qualified Purchaser", ownership: 22.1 },
  { id: "inv-4", name: "Sovereign Endowment Fund", wallet: "0x5f7A...2b3C", verificationStatus: "Pending", fundEligibility: "Institutional", ownership: 15.8 },
  { id: "inv-5", name: "Atlas Growth Capital", wallet: "0x9c1D...6e8F", verificationStatus: "Verified", fundEligibility: "Accredited Investor", ownership: 12.4 },
  { id: "inv-6", name: "Unverified Wallet Co.", wallet: "0xdEaD...bEeF", verificationStatus: "Revoked", fundEligibility: "N/A", ownership: 0 },
];

// --- Subscriptions ---
export const subscriptions: Subscription[] = [
  { id: "sub-1", ref: "SUB-2025-001", investorId: "inv-1", investorName: "BlackRock Capital Partners", allocation: 28.5, committedAmount: 21375000, status: "Settled", lpaHash: "0xabc1...def2", timestamp: "2025-01-15T10:30:00Z" },
  { id: "sub-2", ref: "SUB-2025-002", investorId: "inv-2", investorName: "Meridian Wealth Holdings", allocation: 18.2, committedAmount: 13650000, status: "Settled", lpaHash: "0xabc3...def4", timestamp: "2025-02-01T14:15:00Z" },
  { id: "sub-3", ref: "SUB-2025-003", investorId: "inv-3", investorName: "Pacific Rim Advisors LLC", allocation: 22.1, committedAmount: 16575000, status: "Pending", lpaHash: "0xabc5...def6", timestamp: "2025-03-10T09:00:00Z" },
  { id: "sub-4", ref: "SUB-2025-004", investorId: "inv-4", investorName: "Sovereign Endowment Fund", allocation: 15.8, committedAmount: 11850000, status: "Pending", lpaHash: "0xabc7...def8", timestamp: "2025-03-12T16:45:00Z" },
  { id: "sub-5", ref: "SUB-2025-005", investorId: "inv-5", investorName: "Atlas Growth Capital", allocation: 12.4, committedAmount: 9300000, status: "Rejected", lpaHash: "0xabc9...defa", timestamp: "2025-02-20T11:30:00Z" },
];

// --- Transfers ---
export const transfers: Transfer[] = [
  { id: "tx-1", fromWallet: "0x1a2B...9c4D", toWallet: "0x3e5F...7a1B", amount: 2500000, status: "Success", txHash: "0xfed1...abc2", timestamp: "2025-03-01T08:00:00Z" },
  { id: "tx-2", fromWallet: "0x8d2C...4e6A", toWallet: "0x5f7A...2b3C", amount: 1750000, status: "Success", txHash: "0xfed3...abc4", timestamp: "2025-03-02T12:30:00Z" },
  { id: "tx-3", fromWallet: "0x9c1D...6e8F", toWallet: "0xdEaD...bEeF", amount: 500000, status: "Failed", failureReason: "Recipient wallet not verified", timestamp: "2025-03-03T15:45:00Z" },
  { id: "tx-4", fromWallet: "0x3e5F...7a1B", toWallet: "0x1a2B...9c4D", amount: 800000, status: "Failed", failureReason: "Exceeds transfer limit", timestamp: "2025-03-04T09:15:00Z" },
  { id: "tx-5", fromWallet: "0x5f7A...2b3C", toWallet: "0x9c1D...6e8F", amount: 3200000, status: "Success", txHash: "0xfed5...abc6", timestamp: "2025-03-05T14:00:00Z" },
];

// --- Cap Table ---
export const capTable: CapTableEntry[] = [
  { id: "cap-1", investorName: "BlackRock Capital Partners", wallet: "0x1a2B...9c4D", pendingAllocation: 0, settledTokenBalance: 21375000, ownership: 28.5, lastUpdated: "2025-03-01" },
  { id: "cap-2", investorName: "Meridian Wealth Holdings", wallet: "0x3e5F...7a1B", pendingAllocation: 0, settledTokenBalance: 13650000, ownership: 18.2, lastUpdated: "2025-03-01" },
  { id: "cap-3", investorName: "Pacific Rim Advisors LLC", wallet: "0x8d2C...4e6A", pendingAllocation: 22.1, settledTokenBalance: 0, ownership: 22.1, lastUpdated: "2025-03-10" },
  { id: "cap-4", investorName: "Sovereign Endowment Fund", wallet: "0x5f7A...2b3C", pendingAllocation: 15.8, settledTokenBalance: 0, ownership: 15.8, lastUpdated: "2025-03-12" },
  { id: "cap-5", investorName: "Atlas Growth Capital", wallet: "0x9c1D...6e8F", pendingAllocation: 0, settledTokenBalance: 9300000, ownership: 12.4, lastUpdated: "2025-02-28" },
];

// --- Distribution ---
export const distributionConfig = {
  basis: "Net Asset Value",
  frequency: "Quarterly",
  catchUp: "100% to GP until 8% preferred return met",
  gpPromote: "20% above 8% hurdle",
};

export const distributions: DistributionEntry[] = [
  { id: "dist-1", investorName: "BlackRock Capital Partners", ownership: 28.5, grossAllocation: 855000, tier1: 641250, tier2: 128250, tier3: 85500 },
  { id: "dist-2", investorName: "Meridian Wealth Holdings", ownership: 18.2, grossAllocation: 546000, tier1: 409500, tier2: 81900, tier3: 54600 },
  { id: "dist-3", investorName: "Pacific Rim Advisors LLC", ownership: 22.1, grossAllocation: 663000, tier1: 497250, tier2: 99450, tier3: 66300 },
  { id: "dist-4", investorName: "Sovereign Endowment Fund", ownership: 15.8, grossAllocation: 474000, tier1: 355500, tier2: 71100, tier3: 47400 },
  { id: "dist-5", investorName: "Atlas Growth Capital", ownership: 12.4, grossAllocation: 372000, tier1: 279000, tier2: 55800, tier3: 37200 },
];

// --- Exports ---
export const exportJobs: ExportJob[] = [
  { id: "EXP-001", type: "Full Audit Packet", requestedAt: "2025-03-01T10:00:00Z", status: "Completed", artifact: "audit_q1_2025.zip" },
  { id: "EXP-002", type: "Cap Table Snapshot", requestedAt: "2025-03-05T14:30:00Z", status: "Completed", artifact: "captable_20250305.csv" },
  { id: "EXP-003", type: "Distribution Report", requestedAt: "2025-03-10T09:15:00Z", status: "Processing" },
  { id: "EXP-004", type: "Investor KYC Summary", requestedAt: "2025-03-12T16:00:00Z", status: "Failed" },
];

// --- Fund Overview ---
export const fundOverview = {
  name: "Brookfield Real Estate Income Trust",
  type: "Real Estate",
  size: "T USD 7,500 mn",
  manager: "Brookfield",
  status: "Semi-Open Ended",
  vintage: "2019",
  domicile: "Maryland",
  legalStructure: "REIT",
  separateAccount: "No",
  singleDealFund: "No",
  continuationFund: "No",
  managementFee: "1.25%",
  collectionFrequency: "Monthly",
  committedCapital: 75000000,
  settledCapital: 44325000,
  activeLPs: 5,
  pendingSubscriptions: 2,
};
