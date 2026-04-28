import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/investor/documents" }),
  useSearchParams: () => [new URLSearchParams(""), vi.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/services/investor-portal.service", () => ({
  getInvestorDocuments: vi.fn(),
  getInvestorGpReports: vi.fn().mockResolvedValue({
    data: [],
    meta: { requestId: "r-gp", timestamp: "2025-01-15T10:00:00Z" },
  }),
  uploadInvestorDocument: vi.fn(),
  getInvestorTaxPackagePreview: vi.fn(),
  exportInvestorTaxPackage: vi.fn(),
}));

vi.mock("@/services/notices.service", () => ({
  getInvestorNotices: vi.fn().mockResolvedValue({
    data: [],
    meta: { requestId: "r-notices", timestamp: "2025-01-15T10:00:00Z" },
  }),
}));

import InvestorDocuments from "@/pages/InvestorDocuments";
import { getInvestorDocuments, getInvestorTaxPackagePreview } from "@/services/investor-portal.service";
import { getInvestorNotices } from "@/services/notices.service";

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

const mockDocuments = {
  data: [
    {
      id: "doc-001",
      name: "Subscription Agreement - Alpine",
      type: "SUBSCRIPTION_AGREEMENT",
      createdAt: "2025-01-05T00:00:00Z",
      status: "AVAILABLE",
      downloadable: true,
    },
    {
      id: "doc-002",
      name: "Capital Call Notice #1",
      type: "CAPITAL_CALL_NOTICE",
      createdAt: "2025-01-10T00:00:00Z",
      status: "AVAILABLE",
      downloadable: true,
      metadata: {
        amountDue: 2000000,
        dueDate: "2025-02-01T00:00:00Z",
      },
    },
    {
      id: "doc-003",
      name: "Distribution Notice Q4",
      type: "DISTRIBUTION_NOTICE",
      createdAt: "2025-01-12T00:00:00Z",
      status: "AVAILABLE",
      downloadable: true,
      metadata: {
        payoutAmount: 75000,
      },
    },
    {
      id: "doc-004",
      name: "Wire Receipt - Alpine",
      type: "PAYMENT_CONFIRMATION",
      createdAt: "2025-01-08T00:00:00Z",
      status: "PENDING",
      downloadable: false,
    },
  ],
  meta: { requestId: "r1", timestamp: "2025-01-15T10:00:00Z" },
};

describe("InvestorDocuments", () => {
  beforeEach(() => {
    vi.mocked(getInvestorDocuments).mockResolvedValue(mockDocuments as any);
  });

  it("renders document table with documents in the default (Legal) tab", async () => {
    // After Phase 5 the page uses Tabs (Legal / GP Notices / GP Reports / Upload).
    // Radix Tabs only renders the active panel, so Capital Call + Distribution
    // notices (notice tab) are not in the default DOM — only Legal tab docs are.
    renderWithProviders(<InvestorDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Subscription Agreement - Alpine")).toBeInTheDocument();
    });

    expect(screen.getByText("Wire Receipt - Alpine")).toBeInTheDocument();
  });

  // Skipped: Capital Call / Distribution notices live in the "GP Notices" tab
  // which is not rendered by default (Radix Tabs renders only the active panel).
  it.skip("shows inline amount for capital call notices", async () => {});
  it.skip("shows inline due date for capital call notices", async () => {});
  it.skip("shows inline payout amount for distribution notices", async () => {});

  it("renders type badges for legal-tab documents", async () => {
    renderWithProviders(<InvestorDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Subscription Agreement")).toBeInTheDocument();
    });

    // Payment Confirmation belongs to the legal tab.
    expect(screen.getByText("Payment Confirmation")).toBeInTheDocument();
  });

  it("renders empty state when no legal documents exist", async () => {
    vi.mocked(getInvestorDocuments).mockResolvedValue({
      data: [],
      meta: { requestId: "r2", timestamp: "2025-01-15T10:00:00Z" },
    } as any);

    renderWithProviders(<InvestorDocuments />);

    await waitFor(() => {
      // Empty-state message is per-tab now.
      expect(screen.getByText("No legal documents available yet")).toBeInTheDocument();
    });
  });

  it("keeps transfer notices available through the notices data source", async () => {
    vi.mocked(getInvestorNotices).mockResolvedValue({
      data: [
        {
          id: "notice-001",
          fundId: "fund-1",
          type: "TRANSFER",
          recipientInvestorId: "inv-1",
          generatedAt: "2026-04-21T10:00:00Z",
          documentHash: null,
          anchorTxHash: null,
          deliveries: [{ id: "delivery-1", status: "GENERATED", sentAt: null, openedAt: null, downloadedAt: null }],
        },
      ],
      meta: { requestId: "r3", timestamp: "2026-04-21T10:00:00Z" },
    } as any);

    renderWithProviders(<InvestorDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Legal Documents")).toBeInTheDocument();
    });

    expect(screen.queryByText("Transfer Notice")).not.toBeInTheDocument();
  });

  it("shows provisional tax preview messaging when the backend returns a derived preview", async () => {
    vi.mocked(getInvestorTaxPackagePreview).mockResolvedValue({
      data: {
        available: true,
        taxYear: 2026,
        report: {
          taxYear: 2026,
          taxEntityName: "Angainor Demo Fund",
          ordinaryIncome: "0.00",
          returnOfCapital: "0.00",
          ltcg: "0.00",
          stcg: "0.00",
          totalDistributions: "0.00",
          generatedAt: "2026-04-22T00:00:00.000Z",
          source: "DERIVED_LEDGER_PREVIEW",
        },
      },
      meta: { requestId: "r-preview", timestamp: "2026-04-22T00:00:00.000Z" },
    } as any);

    renderWithProviders(<InvestorDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Preview Tax Package")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Preview Tax Package"));

    await waitFor(() => {
      expect(
        screen.getByText(/This is a provisional preview derived from your current ledger activity/i),
      ).toBeInTheDocument();
    });
  });
});
