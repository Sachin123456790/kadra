import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/investor/documents" }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/services/investor-portal.service", () => ({
  getInvestorDocuments: vi.fn(),
}));

import InvestorDocuments from "@/pages/InvestorDocuments";
import { getInvestorDocuments } from "@/services/investor-portal.service";

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

  it("renders document table with all documents", async () => {
    renderWithProviders(<InvestorDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Subscription Agreement - Alpine")).toBeInTheDocument();
    });

    expect(screen.getByText("Capital Call Notice #1")).toBeInTheDocument();
    expect(screen.getByText("Distribution Notice Q4")).toBeInTheDocument();
    expect(screen.getByText("Wire Receipt - Alpine")).toBeInTheDocument();
  });

  it("shows inline amount for capital call notices", async () => {
    renderWithProviders(<InvestorDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Capital Call Notice #1")).toBeInTheDocument();
    });

    // The capital call notice should show "Amount Due: $2,000,000.00" inline
    expect(screen.getByText(/Amount Due:.*\$2,000,000\.00/)).toBeInTheDocument();
  });

  it("shows inline due date for capital call notices", async () => {
    renderWithProviders(<InvestorDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Capital Call Notice #1")).toBeInTheDocument();
    });

    // Should show the due date formatted (in a separate span from Amount Due)
    expect(screen.getByText(/^Due:/)).toBeInTheDocument();
  });

  it("shows inline payout amount for distribution notices", async () => {
    renderWithProviders(<InvestorDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Distribution Notice Q4")).toBeInTheDocument();
    });

    // Should show "Payout: $75,000.00" inline
    expect(screen.getByText(/Payout:.*\$75,000\.00/)).toBeInTheDocument();
  });

  it("renders type badges with correct labels", async () => {
    renderWithProviders(<InvestorDocuments />);

    await waitFor(() => {
      expect(screen.getByText("Subscription Agreement")).toBeInTheDocument();
    });

    expect(screen.getByText("Capital Call Notice")).toBeInTheDocument();
    expect(screen.getByText("Distribution Notice")).toBeInTheDocument();
    expect(screen.getByText("Payment Confirmation")).toBeInTheDocument();
  });

  it("renders empty state when no documents exist", async () => {
    vi.mocked(getInvestorDocuments).mockResolvedValue({
      data: [],
      meta: { requestId: "r2", timestamp: "2025-01-15T10:00:00Z" },
    } as any);

    renderWithProviders(<InvestorDocuments />);

    await waitFor(() => {
      expect(screen.getByText("No documents available yet")).toBeInTheDocument();
    });
  });
});
