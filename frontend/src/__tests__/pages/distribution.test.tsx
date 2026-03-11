import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/distribution" }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

vi.mock("@/services/fund.service", () => ({
  getWaterfallConfig: vi.fn(),
}));

vi.mock("@/services/distribution.service", () => ({
  previewDistribution: vi.fn(),
}));

vi.mock("@/services/ownership.service", () => ({
  getCapitalAccounts: vi.fn(),
}));

vi.mock("@/services/documents.service", () => ({
  getDocuments: vi.fn(),
}));

import DistributionPage from "@/pages/DistributionPage";
import { getWaterfallConfig } from "@/services/fund.service";
import { getCapitalAccounts } from "@/services/ownership.service";
import { getDocuments } from "@/services/documents.service";

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

const mockWaterfallConfig = {
  data: {
    waterfallConfigId: "wf-001",
    version: "1.0",
    calculationBasis: "IRR",
    distributionFrequency: "Quarterly",
    catchUpEnabled: true,
    gpPromotePct: 20,
    prefReturnPct: 8,
    rules: {
      tiers: [
        { name: "Return of Capital", hurdle: "100% to LPs", lpShare: 100, gpShare: 0 },
        { name: "Preferred Return", hurdle: "8% simple annual", lpShare: 100, gpShare: 0 },
        { name: "GP Catch-up", hurdle: "100% to GP", lpShare: 0, gpShare: 100 },
        { name: "Carried Interest", hurdle: "80/20 split", lpShare: 80, gpShare: 20 },
      ],
    },
  },
  meta: { requestId: "r1", timestamp: "2025-01-15T10:00:00Z" },
};

const mockCapitalAccounts = {
  data: [
    {
      id: "ca-001",
      investorId: "inv-001",
      openingBalance: "0",
      initialContribution: "2000000",
      capitalReturned: "0",
      accruedPreferredReturn: "160000",
      endingBalance: "2160000",
      asOfDate: "2025-01-15T00:00:00Z",
      distributionsReceived: "50000",
      investor: { legalName: "Alpine Capital Partners", email: "alpine@example.com" },
    },
  ],
  meta: { requestId: "r2", timestamp: "2025-01-15T10:00:00Z" },
};

const mockDocuments = {
  data: [
    {
      documentId: "doc-lpa-001",
      documentType: "MASTER_LPA",
      originalFilename: "LPA.pdf",
      mimeType: "application/pdf",
      byteSize: 10000,
      parseStatus: "COMPLETE",
      uploadedBy: null,
      hash: { hashHex: "0xLPAHASH_abc123def456789", algorithm: "SHA-256", anchoredOnchain: true },
      extractedFieldCount: 5,
      metadata: {},
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ],
  meta: { requestId: "r3", timestamp: "2025-01-15T10:00:00Z" },
};

describe("DistributionPage", () => {
  beforeEach(() => {
    vi.mocked(getWaterfallConfig).mockResolvedValue(mockWaterfallConfig as any);
    vi.mocked(getCapitalAccounts).mockResolvedValue(mockCapitalAccounts as any);
    vi.mocked(getDocuments).mockResolvedValue(mockDocuments as any);
  });

  it("renders waterfall tier breakdown cards", async () => {
    renderWithProviders(<DistributionPage />);

    await waitFor(() => {
      expect(screen.getByText("Return of Capital")).toBeInTheDocument();
    });

    expect(screen.getByText("Preferred Return")).toBeInTheDocument();
    expect(screen.getByText("GP Catch-up")).toBeInTheDocument();
    expect(screen.getByText("Carried Interest")).toBeInTheDocument();
  });

  it("renders waterfall configuration metadata", async () => {
    renderWithProviders(<DistributionPage />);

    await waitFor(() => {
      expect(screen.getByText("Calculation Basis")).toBeInTheDocument();
    });

    expect(screen.getByText("IRR")).toBeInTheDocument();
    expect(screen.getByText("Quarterly")).toBeInTheDocument();
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("renders LPA hash in waterfall config section under 'Derived From'", async () => {
    renderWithProviders(<DistributionPage />);

    await waitFor(() => {
      expect(screen.getByText("Derived From (LPA Hash)")).toBeInTheDocument();
    });

    // Hash "0xLPAHASH_abc123def456789" truncated to "0xLPAH...6789"
    expect(screen.getByText("0xLPAH...6789")).toBeInTheDocument();
  });

  it("renders 'Distributions Received' column in capital accounts", async () => {
    renderWithProviders(<DistributionPage />);

    // Wait for capital accounts data to fully load (not just the section title)
    await waitFor(() => {
      expect(screen.getByText("Alpine Capital Partners")).toBeInTheDocument();
    });

    expect(screen.getByText("Distributions Received")).toBeInTheDocument();
  });

  it("renders capital account rows with correct values", async () => {
    renderWithProviders(<DistributionPage />);

    await waitFor(() => {
      expect(screen.getByText("Alpine Capital Partners")).toBeInTheDocument();
    });

    // Check initial contribution renders as currency
    expect(screen.getByText("$2,000,000")).toBeInTheDocument();
  });
});
