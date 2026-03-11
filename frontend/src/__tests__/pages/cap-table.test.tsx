import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/cap-table" }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

vi.mock("@/services/ownership.service", () => ({
  getCapTable: vi.fn(),
  getCapitalAccounts: vi.fn(),
}));

vi.mock("@/services/subscriptions.service", () => ({
  getSubscriptions: vi.fn(),
}));

vi.mock("@/services/audit.service", () => ({
  createAuditExport: vi.fn(),
}));

import CapTablePage from "@/pages/CapTablePage";
import { getCapTable } from "@/services/ownership.service";
import { getSubscriptions } from "@/services/subscriptions.service";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

const mockCapTable = {
  data: {
    fundId: "KADRA-DEMO-001",
    asOfTimestamp: "2025-01-15T10:00:00Z",
    rows: [
      {
        investorId: "inv-001",
        investorName: "Alpine Capital Partners",
        walletAddress: "0xABCD1234567890abcdef1234567890ABCDEF1234",
        pendingAllocationPct: 0,
        settledTokenBalance: "2000",
        ownershipPct: 20,
      },
      {
        investorId: "inv-002",
        investorName: "Bridgewater Associates",
        walletAddress: "0xDEAD5678901234567890abcdef5678901234DEAD",
        pendingAllocationPct: 0,
        settledTokenBalance: "2000",
        ownershipPct: 20,
      },
    ],
  },
  meta: { requestId: "r1", timestamp: "2025-01-15T10:00:00Z" },
};

const mockSubscriptions = {
  data: [
    {
      subscriptionId: "sub-001",
      subscriptionRef: "SUB-ALPINE",
      investorId: "inv-001",
      investorName: "Alpine Capital Partners",
      walletId: "w-001",
      allocationPct: 20,
      committedAmount: "2000000",
      status: "SETTLED",
      settledAt: "2025-01-10T12:00:00Z",
      createdAt: "2025-01-01T00:00:00Z",
      governingHashHex: "0xabc123def456789012345678901234567890abcdef",
      latestSettlementStatus: "CONFIRMED",
      settlementTxHash: "0xtx123settlement456",
    },
    {
      subscriptionId: "sub-002",
      subscriptionRef: "SUB-BRIDGE",
      investorId: "inv-002",
      investorName: "Bridgewater Associates",
      walletId: "w-002",
      allocationPct: 20,
      committedAmount: "2000000",
      status: "SETTLED",
      settledAt: "2025-01-10T12:00:00Z",
      createdAt: "2025-01-01T00:00:00Z",
      governingHashHex: "0xabc123def456789012345678901234567890abcdef",
      latestSettlementStatus: "CONFIRMED",
      settlementTxHash: null,
    },
  ],
  meta: { requestId: "r2", timestamp: "2025-01-15T10:00:00Z" },
};

describe("CapTablePage", () => {
  beforeEach(() => {
    vi.mocked(getCapTable).mockResolvedValue(mockCapTable as any);
    vi.mocked(getSubscriptions).mockResolvedValue(mockSubscriptions as any);
  });

  it("renders all required column headers including Settlement Tx", async () => {
    renderWithProviders(<CapTablePage />);

    await waitFor(() => {
      expect(screen.getByText("Alpine Capital Partners")).toBeInTheDocument();
    });

    const expectedHeaders = [
      "Investor",
      "Wallet",
      "Ownership %",
      "Token Balance",
      "Capital Contributed",
      "Settlement Date",
      "Settlement Tx",
      "Governing LPA Hash",
    ];

    for (const header of expectedHeaders) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }
  });

  it("renders investor names and ownership percentages", async () => {
    renderWithProviders(<CapTablePage />);

    await waitFor(() => {
      expect(screen.getByText("Alpine Capital Partners")).toBeInTheDocument();
    });

    expect(screen.getByText("Bridgewater Associates")).toBeInTheDocument();
    expect(screen.getAllByText("20.00%")).toHaveLength(2);
  });

  it("renders metric cards with correct totals", async () => {
    renderWithProviders(<CapTablePage />);

    await waitFor(() => {
      expect(screen.getByText("Total Investors")).toBeInTheDocument();
    });

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("40.0%")).toBeInTheDocument();
  });

  it("renders truncated governing LPA hash with copy button", async () => {
    renderWithProviders(<CapTablePage />);

    await waitFor(() => {
      expect(screen.getByText("Alpine Capital Partners")).toBeInTheDocument();
    });

    // The hash "0xabc123def456789012345678901234567890abcdef" should be truncated
    // to "0xabc1...cdef"
    const truncatedHashes = screen.getAllByText("0xabc1...cdef");
    expect(truncatedHashes.length).toBeGreaterThan(0);
  });
});
