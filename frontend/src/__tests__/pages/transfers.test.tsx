import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/transfers" }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/services", () => ({
  getFailedTransfers: vi.fn(),
  getSuccessfulTransfers: vi.fn(),
  getDocuments: vi.fn(),
  getInvestors: vi.fn(),
}));

import TransfersPage from "@/pages/TransfersPage";
import {
  getFailedTransfers,
  getSuccessfulTransfers,
  getDocuments,
  getInvestors,
} from "@/services";

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

const mockSuccessfulTransfers = {
  data: [
    {
      transferRequestId: "tr-001",
      fromWalletAddress: "0xABCD1234567890abcdef1234567890ABCDEF1234",
      toWalletAddress: "0xDEAD5678901234567890abcdef5678901234DEAD",
      tokenAmount: "500",
      txHash: "0xtx_success_hash_123",
      timestamp: "2025-01-12T14:30:00Z",
    },
  ],
  meta: { requestId: "r1", timestamp: "2025-01-15T10:00:00Z" },
};

const mockFailedTransfers = {
  data: [
    {
      transferRequestId: "tr-002",
      failureStage: "PRECHECK",
      failureCode: "RECIPIENT_NOT_ELIGIBLE",
      fromWalletAddress: "0xABCD1234567890abcdef1234567890ABCDEF1234",
      toWalletAddress: "0x9999888877776666555544443333222211110000",
      tokenAmount: "100",
      timestamp: "2025-01-13T09:00:00Z",
    },
  ],
  meta: { requestId: "r2", timestamp: "2025-01-15T10:00:00Z" },
};

const mockInvestors = {
  data: [
    {
      investorId: "inv-001",
      legalName: "Alpine Capital Partners",
      email: "alpine@example.com",
      verificationStatus: "VERIFIED",
      wallets: [
        { walletId: "w-001", address: "0xABCD1234567890abcdef1234567890ABCDEF1234", chainId: 11155111, isPrimary: true, status: "ACTIVE" },
      ],
      fundEligibility: null,
    },
    {
      investorId: "inv-002",
      legalName: "Bridgewater Associates",
      email: "bridge@example.com",
      verificationStatus: "VERIFIED",
      wallets: [
        { walletId: "w-002", address: "0xDEAD5678901234567890abcdef5678901234DEAD", chainId: 11155111, isPrimary: true, status: "ACTIVE" },
      ],
      fundEligibility: null,
    },
  ],
  meta: { requestId: "r3", timestamp: "2025-01-15T10:00:00Z" },
};

const mockDocuments = {
  data: [
    {
      documentId: "doc-001",
      documentType: "MASTER_LPA",
      originalFilename: "LPA.pdf",
      mimeType: "application/pdf",
      byteSize: 10000,
      parseStatus: "COMPLETE",
      uploadedBy: null,
      hash: { hashHex: "0xLPA_HASH_for_transfer_rules_1234", algorithm: "SHA-256", anchoredOnchain: true },
      extractedFieldCount: 5,
      metadata: {},
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ],
  meta: { requestId: "r4", timestamp: "2025-01-15T10:00:00Z" },
};

describe("TransfersPage", () => {
  beforeEach(() => {
    vi.mocked(getSuccessfulTransfers).mockResolvedValue(mockSuccessfulTransfers as any);
    vi.mocked(getFailedTransfers).mockResolvedValue(mockFailedTransfers as any);
    vi.mocked(getInvestors).mockResolvedValue(mockInvestors as any);
    vi.mocked(getDocuments).mockResolvedValue(mockDocuments as any);
  });

  it("renders 'From LP' and 'To LP' column headers", async () => {
    renderWithProviders(<TransfersPage />);

    await waitFor(() => {
      expect(screen.getByText("From LP")).toBeInTheDocument();
    });

    expect(screen.getByText("To LP")).toBeInTheDocument();
  });

  it("renders LP names resolved from wallet addresses", async () => {
    renderWithProviders(<TransfersPage />);

    await waitFor(() => {
      // Alpine appears as "From LP" in both the successful and failed transfer rows
      const alpineElements = screen.getAllByText("Alpine Capital Partners");
      expect(alpineElements.length).toBeGreaterThanOrEqual(1);
    });

    // Bridgewater is the "To LP" in the successful transfer
    expect(screen.getByText("Bridgewater Associates")).toBeInTheDocument();
  });

  it("renders 'Rules Derived From' with LPA hash in transfer rules card", async () => {
    renderWithProviders(<TransfersPage />);

    await waitFor(() => {
      expect(screen.getByText("Rules Derived From")).toBeInTheDocument();
    });

    // Hash "0xLPA_HASH_for_transfer_rules_1234" truncated to "0xLPA_...1234"
    expect(screen.getByText("0xLPA_...1234")).toBeInTheDocument();
  });

  it("renders transfer rules metadata correctly", async () => {
    renderWithProviders(<TransfersPage />);

    await waitFor(() => {
      expect(screen.getByText("Transfer Restriction Type")).toBeInTheDocument();
    });

    expect(screen.getByText("LP Only")).toBeInTheDocument();
    expect(screen.getByText("Identity Registry Address")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("renders failed transfer with failure reason", async () => {
    renderWithProviders(<TransfersPage />);

    await waitFor(() => {
      expect(screen.getByText("RECIPIENT NOT ELIGIBLE")).toBeInTheDocument();
    });

    expect(screen.getByText("Not Eligible")).toBeInTheDocument();
    expect(screen.getByText("Reverted")).toBeInTheDocument();
  });

  it("renders successful transfer with 'Eligible' and 'Executed' badges", async () => {
    renderWithProviders(<TransfersPage />);

    await waitFor(() => {
      expect(screen.getByText("Eligible")).toBeInTheDocument();
    });

    expect(screen.getByText("Executed")).toBeInTheDocument();
  });
});
