import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/services/tokenization.service", () => ({
  mintTokens: vi.fn(),
}));

import SettlementPage from "@/pages/SettlementPage";
import { getSubscriptions } from "@/services";
import { getCapitalCalls } from "@/services/capital-calls.service";
import { mintTokens } from "@/services/tokenization.service";

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
      mintTxHash: null,
      mintedAt: null,
      mintEventId: null,
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
      fundId: "ANGAINOR-DEMO-001",
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
    vi.mocked(mintTokens).mockResolvedValue({
      data: {
        mintRequestId: "mint-001",
        status: "CONFIRMED",
        txHash: "0x123",
        tokenAmount: "2000",
      },
      meta: {},
    } as any);
  });

  // Skipped: "Payment Received" column was removed in Phase 2 refactor; settlement
  // history table no longer renders that column header.
  it.skip("renders 'Payment Received' column header in settlement history", async () => {
    renderWithProviders(<SettlementPage />);

    await waitFor(() => {
      expect(screen.getByText("Alpine Capital Partners")).toBeInTheDocument();
    });

    expect(screen.getByText("Payment Received")).toBeInTheDocument();
  });

  // Skipped: "Settlement Tx Hash" column was removed; settled rows now render a
  // compact "Verified" badge in the Verification column instead of a tx hash link.
  it.skip("renders 'Settlement Tx Hash' column header", async () => {
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

  it("renders per-row mint action and calls single mint endpoint", async () => {
    renderWithProviders(<SettlementPage />);

    await waitFor(() => {
      expect(screen.getByText("Alpine Capital Partners")).toBeInTheDocument();
    });

    const mintButton = screen.getAllByRole("button", { name: "Mint" })[0];
    fireEvent.click(mintButton);

    await waitFor(() => {
      expect(mintTokens).toHaveBeenCalledWith("sub-001");
    });
  });

  it("replaces the mint action with a tx link when the subscription is already minted", async () => {
    vi.mocked(getSubscriptions).mockImplementation((_fundId: string, status?: string) => {
      if (status === "PENDING") return Promise.resolve(mockPendingSubs as any);
      if (status === "SETTLED") {
        return Promise.resolve({
          ...mockSettledSubs,
          data: [
            {
              ...mockSettledSubs.data[0],
              mintTxHash: "0xtx_mint_hash_123",
              mintedAt: "2025-01-11T09:30:00Z",
              mintEventId: "evt-mint-1",
            },
          ],
        } as any);
      }
      return Promise.resolve(mockSettledSubs as any);
    });

    renderWithProviders(<SettlementPage />);

    await waitFor(() => {
      expect(screen.getByText("Alpine Capital Partners")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Mint" })).not.toBeInTheDocument();
    expect(screen.getByText("Minted")).toBeInTheDocument();
    expect(screen.getAllByRole("link").some((link) =>
      link.getAttribute("href")?.includes("0xtx_mint_hash_123"),
    )).toBe(true);
  });

  // Skipped: settlement tx hash is no longer rendered as an ExplorerLink on the
  // settlement history row; it was replaced by a "Verified" badge.
  it.skip("renders settlement Tx hash from subscription (not LPA hash)", async () => {
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
