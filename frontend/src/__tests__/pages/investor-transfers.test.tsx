import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/investor/transfers" }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/services", () => ({
  getMyTransfers: vi.fn(),
  getMyDashboard: vi.fn(),
  getInvestorCapTable: vi.fn(),
}));

vi.mock("@/services/wallet-profile.service", () => ({
  getMyProfile: vi.fn(),
}));

vi.mock("@/services/tokenization.service", () => ({
  validateTransfer: vi.fn(),
  confirmTransfer: vi.fn(),
}));

const walletMock = vi.hoisted(() => ({
  connectWallet: vi.fn(),
  sendTransaction: vi.fn(),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    status: "connected",
    address: "0x1234567890123456789012345678901234567890",
    error: null,
    connectWallet: walletMock.connectWallet,
    sendTransaction: walletMock.sendTransaction,
  }),
}));

vi.mock("@/hooks/useHighlightRow", () => ({
  useHighlightRow: () => ({
    highlightId: null,
    isPulsing: false,
  }),
}));

import InvestorTransfersPage from "@/pages/InvestorTransfers";
import { getMyTransfers, getMyDashboard, getInvestorCapTable } from "@/services";
import { getMyProfile } from "@/services/wallet-profile.service";
import { validateTransfer, confirmTransfer } from "@/services/tokenization.service";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>,
  );
}

const mockDashboard = {
  data: {
    investor: {
      id: "inv-1",
      legalName: "Alpine Capital",
      email: "alpine@example.com",
      verificationStatus: "VERIFIED",
    },
    wallets: [
      {
        id: "wallet-1",
        address: "0x1234567890123456789012345678901234567890",
        chainId: 11155111,
        isPrimary: true,
        walletStatus: "ACTIVE",
      },
    ],
    eligibility: [
      {
        id: "elig-1",
        eligibilityStatus: "ELIGIBLE",
        effectiveAt: "2025-01-01T00:00:00Z",
        revokedAt: null,
      },
    ],
    subscriptions: [],
    tokenPositions: [],
    capitalAccount: null,
    summary: {
      totalCommitted: "1000000",
      totalSettled: "1000000",
      tokenBalance: "1000",
      ownershipPct: 10,
    },
  },
};

describe("InvestorTransfers", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getMyTransfers).mockResolvedValue({
      data: [],
      meta: { requestId: "req-transfers", timestamp: "2025-01-01T00:00:00Z" },
    } as any);
    vi.mocked(getMyDashboard).mockResolvedValue(mockDashboard as any);
    vi.mocked(getInvestorCapTable).mockResolvedValue({
      data: { fundId: "ANGAINOR-DEMO-001", fundName: "Fund", asOfTimestamp: "2025-01-01T00:00:00Z", rows: [] },
      meta: { requestId: "req-cap", timestamp: "2025-01-01T00:00:00Z" },
    } as any);
    vi.mocked(getMyProfile).mockResolvedValue({
      data: {
        authUserId: "auth-1",
        investorId: "inv-1",
        legalName: "Alpine Capital",
        email: "alpine@example.com",
        verificationStatus: "VERIFIED",
        walletCount: 1,
      },
      meta: { requestId: "req-profile", timestamp: "2025-01-01T00:00:00Z" },
    } as any);
    walletMock.sendTransaction.mockResolvedValue("0xtxhash");
    vi.mocked(validateTransfer).mockResolvedValue({
      data: {
        transferRequestId: "tr-1",
        requestStatus: "READY",
        precheck: {
          recipientEligible: true,
          senderEligible: true,
          sufficientBalance: true,
        },
        contractAddress: "0x9999999999999999999999999999999999999999",
        txHash: null,
      },
      meta: { requestId: "req-validate", timestamp: "2025-01-01T00:00:00Z" },
    } as any);
    vi.mocked(confirmTransfer).mockResolvedValue({
      data: {
        transferRequestId: "tr-1",
        requestStatus: "CONFIRMED",
        txHash: "0xtxhash",
      },
      meta: { requestId: "req-confirm", timestamp: "2025-01-01T00:00:00Z" },
    } as any);
  });

  it("does not mark accreditation as accredited just because the investor is verified", async () => {
    renderWithProviders(<InvestorTransfersPage />);

    await waitFor(() => {
      expect(screen.getByText("Accreditation Status")).toBeInTheDocument();
    });

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByText("Accredited")).not.toBeInTheDocument();
  });

  it("submits the entered recipient wallet address for transfer validation", async () => {
    renderWithProviders(<InvestorTransfersPage />);

    await waitFor(() => {
      expect(screen.getByText("Recipient Wallet Address")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("0x..."), {
      target: { value: "0x2222222222222222222222222222222222222222" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 500"), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() => {
      expect(validateTransfer).toHaveBeenCalledWith("ANGAINOR-DEMO-001", {
        fromWalletAddress: "0x1234567890123456789012345678901234567890",
        toWalletAddress: "0x2222222222222222222222222222222222222222",
        tokenAmount: "25",
      });
    });

    expect(walletMock.sendTransaction).toHaveBeenCalled();
    expect(confirmTransfer).toHaveBeenCalledWith("tr-1", "0xtxhash");
  });
});
