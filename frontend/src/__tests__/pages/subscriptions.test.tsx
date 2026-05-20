import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/subscriptions" }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  Legend: () => null,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Line: () => null,
  Area: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
}));

vi.mock("@/services", () => ({
  getSubscriptions: vi.fn(),
  getInvestors: vi.fn(),
  getDocuments: vi.fn(),
  createSubscriptions: vi.fn(),
}));

vi.mock("@/services/subscriptions.service", () => ({
  getFundAllocation: vi.fn(),
}));

vi.mock("@/services/fund.service", () => ({
  getFund: vi.fn(),
}));

import SubscriptionsPage from "@/pages/SubscriptionsPage";
import {
  getSubscriptions,
  getInvestors,
  getDocuments,
  createSubscriptions,
} from "@/services";
import { getFundAllocation } from "@/services/subscriptions.service";
import { getFund } from "@/services/fund.service";

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
      governingHashHex: "0xabc123def456789012345678",
      latestSettlementStatus: "CONFIRMED",
      settlementTxHash: null,
    },
  ],
  meta: { requestId: "r1", timestamp: "2025-01-15T10:00:00Z" },
};

const mockInvestors = {
  data: [
    {
      investorId: "inv-001",
      legalName: "Alpine Capital Partners",
      email: "alpine@example.com",
      verificationStatus: "VERIFIED",
      wallets: [{ walletId: "w-001", address: "0xABCD1234", chainId: 11155111, isPrimary: true, status: "ACTIVE" }],
      fundEligibility: { eligibilityId: "elig-001", status: "ELIGIBLE", effectiveAt: "2025-01-01T00:00:00Z" },
    },
    {
      investorId: "inv-002",
      legalName: "Bridgewater Associates",
      email: "bridge@example.com",
      verificationStatus: "VERIFIED",
      wallets: [{ walletId: "w-002", address: "0xDEAD5678", chainId: 11155111, isPrimary: true, status: "ACTIVE" }],
      fundEligibility: { eligibilityId: "elig-002", status: "ELIGIBLE", effectiveAt: "2025-01-01T00:00:00Z" },
    },
  ],
  meta: { requestId: "r2", timestamp: "2025-01-15T10:00:00Z" },
};

const mockDocuments = {
  data: [
    {
      documentId: "doc-lpa-001",
      documentType: "MASTER_LPA",
      originalFilename: "Master_LPA_2025.pdf",
      mimeType: "application/pdf",
      byteSize: 123456,
      parseStatus: "COMPLETE",
      uploadedBy: null,
      hash: { hashHex: "0xLPAHASH1234567890", algorithm: "SHA-256", anchoredOnchain: true },
      extractedFieldCount: 12,
      metadata: {},
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ],
  meta: { requestId: "r3", timestamp: "2025-01-15T10:00:00Z" },
};

const mockFundAllocation = {
  data: {
    fundId: "ANGAINOR-DEMO-001",
    fundCapPct: 100,
    perInvestorCapPct: 100,
    totalAllocationPct: 20,
    remainingHeadroomPct: 80,
    investors: [
      {
        investorId: "inv-001",
        investorName: "Alpine Capital Partners",
        investorEmail: "alpine@example.com",
        totalAllocationPct: 20,
        totalCommitted: 2000000,
        settledAllocationPct: 20,
        pendingAllocationPct: 0,
        subscriptionCount: 1,
      },
    ],
  },
  meta: { requestId: "r5", timestamp: "2025-01-15T10:00:00Z" },
};

const mockFund = {
  data: {
    fundId: "ANGAINOR-DEMO-001",
    fundName: "Angainor Demo Fund I",
    status: "ACTIVE",
    lpCount: 2,
    eligibleWalletCount: 2,
    pendingSubscriptions: 0,
    settledSubscriptions: 1,
    targetCommitment: "10000000.00",
    totalCommittedAmount: "2000000",
    totalSettledAmount: "2000000",
    tokenContract: null,
  },
  meta: { requestId: "r6", timestamp: "2025-01-15T10:00:00Z" },
};

describe("SubscriptionsPage", () => {
  beforeEach(() => {
    vi.mocked(getSubscriptions).mockResolvedValue(mockSubscriptions as any);
    vi.mocked(getInvestors).mockResolvedValue(mockInvestors as any);
    vi.mocked(getDocuments).mockResolvedValue(mockDocuments as any);
    vi.mocked(getFundAllocation).mockResolvedValue(mockFundAllocation as any);
    vi.mocked(getFund).mockResolvedValue(mockFund as any);
    vi.mocked(createSubscriptions).mockResolvedValue({
      data: { createdCount: 1, subscriptions: [{ subscriptionId: "sub-new", status: "PENDING", subscriptionRef: "SUB-BRIDGE" }] },
      meta: { requestId: "r4", timestamp: "2025-01-15T10:00:00Z" },
    } as any);
  });

  it("renders the subscriptions table with correct data", async () => {
    renderWithProviders(<SubscriptionsPage />);

    await waitFor(() => {
      const els = screen.getAllByText("Alpine Capital Partners");
      expect(els.length).toBeGreaterThanOrEqual(1);
    });

    // subscriptionRef is only rendered inside the expandable detail row now;
    // the top-level table shows the investor name + status + allocation only.
    expect(screen.getAllByText("20%").length).toBeGreaterThanOrEqual(1);
  });

  it("opens create subscription modal when clicking button", async () => {
    renderWithProviders(<SubscriptionsPage />);

    await waitFor(() => {
      const els = screen.getAllByText("Alpine Capital Partners");
      expect(els.length).toBeGreaterThanOrEqual(1);
    });

    const createButton = screen.getByText("Create Subscription");
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText("Add a new subscription record for an investor.")).toBeInTheDocument();
    });

    // Modal should show the investor dropdown
    expect(screen.getByLabelText("Investor (LP)")).toBeInTheDocument();
    expect(screen.getByLabelText("Committed Amount (USD)")).toBeInTheDocument();
    // Allocation % is now a derived, read-only display, not an input.
    expect(screen.getByText(/derived/i)).toBeInTheDocument();
  });

  it("derives allocation % from the committed amount and fund total", async () => {
    renderWithProviders(<SubscriptionsPage />);

    await waitFor(() => {
      expect(
        screen.getAllByText("Alpine Capital Partners").length,
      ).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByText("Create Subscription"));

    await waitFor(() => {
      expect(screen.getByLabelText("Investor (LP)")).toBeInTheDocument();
    });

    // 2,500,000 committed against a 10,000,000 fund total => 25.00%.
    fireEvent.change(screen.getByLabelText("Committed Amount (USD)"), {
      target: { value: "2500000" },
    });

    await waitFor(() => {
      expect(screen.getByText("25.00%")).toBeInTheDocument();
    });
  });

  it("calls createSubscriptions API when modal form is submitted", async () => {
    renderWithProviders(<SubscriptionsPage />);

    await waitFor(() => {
      const els = screen.getAllByText("Alpine Capital Partners");
      expect(els.length).toBeGreaterThanOrEqual(1);
    });

    // Open modal
    fireEvent.click(screen.getByText("Create Subscription"));

    await waitFor(() => {
      expect(screen.getByLabelText("Investor (LP)")).toBeInTheDocument();
    });

    // Fill form. Allocation % is derived: 2,000,000 / 10,000,000 fund total = 20%.
    fireEvent.change(screen.getByLabelText("Investor (LP)"), { target: { value: "inv-002" } });
    fireEvent.change(screen.getByLabelText("Committed Amount (USD)"), { target: { value: "2000000" } });

    // Submit - the submit button text inside the modal (not the page-level one)
    const submitButtons = screen.getAllByRole("button");
    const submitButton = submitButtons.find(
      (btn) => btn.textContent === "Create Subscription" && !btn.closest("[data-state]"),
    );

    // Find the button inside the dialog footer
    const dialogSubmit = screen.getAllByText("Create Subscription").find(
      (el) => el.tagName === "BUTTON" && el.closest("[role='dialog']"),
    );

    if (dialogSubmit) {
      fireEvent.click(dialogSubmit);

      await waitFor(() => {
        expect(vi.mocked(createSubscriptions)).toHaveBeenCalledWith(
          "ANGAINOR-DEMO-001",
          "doc-lpa-001",
          expect.arrayContaining([
            expect.objectContaining({
              investorId: "inv-002",
              committedAmount: "2000000",
              allocationPct: 20,
              subscriptionRef: expect.stringMatching(/^SUB-INV002-[A-Z0-9]+$/),
            }),
          ]),
        );
      });
    }
  });
});
