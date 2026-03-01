// In-memory state for the demo session
// Persists across API calls as long as the Next.js dev server is running

export interface Subscription {
  id: string;
  investorId: string;
  investorName: string;
  walletAddress: string;
  allocationPercent: number;
  capitalCommitted: string;
  lpaHash: string;
  fundName: string;
  status: "pending" | "settled";
  createdAt: string;
  settledAt: string | null;
}

export interface LogEntry {
  timestamp: string;
  step: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
  data?: Record<string, unknown>;
}

interface DemoState {
  // Contract addresses (null = not deployed)
  identityRegistryAddress: string | null;
  documentRegistryAddress: string | null;
  kadraTokenAddress: string | null;

  // Fund info
  fundName: string;
  lpaHash: string | null;
  lpaFileName: string | null;

  // Investors
  investors: Array<{
    id: string;
    name: string;
    email: string;
    walletIndex: number;
    walletAddress: string | null;
    eligible: boolean;
  }>;

  // Subscriptions
  subscriptions: Subscription[];

  // Activity log
  logs: LogEntry[];

  // Phase tracking
  phase: "not_started" | "deployed" | "investors_registered" | "lpa_anchored" | "subscriptions_created" | "settled" | "complete";
}

const state: DemoState = {
  identityRegistryAddress: null,
  documentRegistryAddress: null,
  kadraTokenAddress: null,
  fundName: "Kadra Demo Fund I",
  lpaHash: null,
  lpaFileName: null,
  investors: [
    { id: "investor-A", name: "Alpha Capital Partners", email: "alpha@example.com", walletIndex: 1, walletAddress: null, eligible: false },
    { id: "investor-B", name: "Beta Ventures LLC", email: "beta@example.com", walletIndex: 2, walletAddress: null, eligible: false },
    { id: "investor-C", name: "Gamma Real Estate Trust", email: "gamma@example.com", walletIndex: 3, walletAddress: null, eligible: false },
    { id: "investor-D", name: "Delta Institutional Fund", email: "delta@example.com", walletIndex: 4, walletAddress: null, eligible: false },
    { id: "investor-E", name: "Epsilon Family Office", email: "epsilon@example.com", walletIndex: 5, walletAddress: null, eligible: false },
  ],
  subscriptions: [],
  logs: [],
  phase: "not_started",
};

export function getState(): DemoState {
  return state;
}

export function addLog(step: string, message: string, type: LogEntry["type"] = "info", data?: Record<string, unknown>) {
  state.logs.push({
    timestamp: new Date().toISOString(),
    step,
    message,
    type,
    data,
  });
}

export function resetState() {
  state.identityRegistryAddress = null;
  state.documentRegistryAddress = null;
  state.kadraTokenAddress = null;
  state.lpaHash = null;
  state.lpaFileName = null;
  state.investors.forEach((inv) => {
    inv.walletAddress = null;
    inv.eligible = false;
  });
  state.subscriptions = [];
  state.logs = [];
  state.phase = "not_started";
}

export default state;
