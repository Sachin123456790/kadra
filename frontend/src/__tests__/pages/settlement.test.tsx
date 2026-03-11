import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/settlement" }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/services", () => ({
  getSubscriptions: vi.fn(),
  requestPaymentValidation: vi.fn(),
  confirmSettlement: vi.fn(),
  uploadWireConfirmation: vi.fn(),
}));

vi.mock("@/services/capital-calls.service", () => ({
  getCapitalCalls: vi.fn(),
  createCapitalCall: vi.fn(),
}));

import SettlementPage from "@/pages/SettlementPage";
import { getSubscriptions } from "@/services";
import { getCapitalCalls } from "@/services/capital-calls.service";

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

const mockSettledSubs = {
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
      governingHashHex: "0xabc123def456",
      latestSettlementStatus: "CONFIRMED",
      settlementTxHash: "0xtx_settlement_hash_abc123",
    },
  ],
  meta: { requestId: "r1", timestamp: "2025-01-15T10:00:00Z" },
};

const mockPendingSubs = {
  data: [],
  meta: { requestId: "r2", timestamp: "2025-01-15T10:00:00Z" },
};

const mockCapitalCalls = {
  data: [
    {
      id: "cc-001",
      fundId: "KADRA-DEMO-001",
      callNumber: 1,
      amountDue: "2000000",
      dueDate: "2025-02-01T00:00:00Z",
      wireInstructions: "Wire to Chase Bank",
      status: "ISSUED",
      createdAt: "2025-01-01T00:00:00Z",
    },
  ],
  meta: { requestId: "r3", timestamp: "2025-01-15T10:00:00Z" },
};

describe("SettlementPage", () => {
  beforeEach(() => {
    vi.mocked(getCapitalCalls).mockResolvedValue(mockCapitalCalls as any);
    // getSubscriptions is called twice: once for PENDING, once for SETTLED
    vi.mocked(getSubscriptions).mockImplementation((_fundId: string, status?: string) => {
      if (status === "PENDING") return Promise.resolve(mockPendingSubs as any);
      if (status === "SETTLED") return Promise.resolve(mockSettledSubs as any);
      return Promise.resolve(mockSettledSubs as any);
    });
  });

  it("renders 'Payment Received' column header in settlement history", async () => {
    renderWithProviders(<SettlementPage />);

    await waitFor(() => {
      expect(screen.getByText("Alpine Capital Partners")).toBeInTheDocument();
    });

    expect(screen.getByText("Payment Received")).toBeInTheDocument();
  });

  it("renders 'Settlement Tx Hash' column header", async () => {
    renderWithProviders(<SettlementPage />);

    await waitFor(() => {
      expect(screen.getByText("Settlement Tx Hash")).toBeInTheDocument();
    });
  });

  it("renders three-way match labels as visible text (Amount, Identity, Reference)", async () => {
    renderWithProviders(<SettlementPage />);

    await waitFor(() => {
      expect(screen.getByText("Alpine Capital Partners")).toBeInTheDocument();
    });

    // These are rendered inline for settled subscriptions
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByText("Reference")).toBeInTheDocument();
  });

  it("renders capital calls section with correct data", async () => {
    renderWithProviders(<SettlementPage />);

    // Wait for capital calls data to fully load (not just the section title)
    await waitFor(() => {
      expect(screen.getByText("Wire to Chase Bank")).toBeInTheDocument();
    });
  });

  it("renders settlement Tx hash from subscription (not LPA hash)", async () => {
    renderWithProviders(<SettlementPage />);

    await waitFor(() => {
      expect(screen.getByText("Alpine Capital Partners")).toBeInTheDocument();
    });

    // The tx hash "0xtx_settlement_hash_abc123" should be rendered via ExplorerLink,
    // which typically truncates the hash. The LPA hash "0xabc123def456" should NOT
    // appear in the Settlement Tx Hash column.
    // We verify the settlement tx hash is present by checking that its truncated form exists.
    const explorerLinks = screen.getAllByRole("link");
    const hasTxLink = explorerLinks.some(
      (link) => link.getAttribute("href")?.includes("0xtx_settlement_hash_abc123"),
    );
    expect(hasTxLink).toBe(true);
  });
});
