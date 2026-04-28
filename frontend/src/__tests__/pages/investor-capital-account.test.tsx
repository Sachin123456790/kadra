import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/investor/capital-account" }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

// Mock sonner toast to verify no alert() calls
const mockToast = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/services/investor-portal.service", () => ({
  getInvestorCapitalAccount: vi.fn(),
  exportCapitalAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/useCurrentFund", () => ({
  useCurrentFund: () => ({
    fundId: "ANGAINOR-DEMO-001",
    fund: null,
    waterfallConfig: {
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
          { name: "Carried Interest", hurdle: "80/20 split", lpShare: 80, gpShare: 20 },
        ],
      },
    },
    targetSize: 10_000_000,
    isLoading: false,
    error: null,
  }),
}));

import InvestorCapitalAccount from "@/pages/InvestorCapitalAccount";
import {
  getInvestorCapitalAccount,
  exportCapitalAccount,
} from "@/services/investor-portal.service";

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

const mockCapitalAccount = {
  data: {
    id: "ca-001",
    openingBalance: "0",
    initialContribution: "2000000",
    capitalReturned: "500000",
    accruedPreferredReturn: "160000",
    residualAllocation: "50000",
    endingBalance: "1710000",
    asOfDate: "2025-01-15T00:00:00Z",
    distributionsReceived: "75000",
  },
  meta: { requestId: "r1", timestamp: "2025-01-15T10:00:00Z" },
};

describe("InvestorCapitalAccount", () => {
  beforeEach(() => {
    vi.mocked(getInvestorCapitalAccount).mockResolvedValue(mockCapitalAccount as any);
    mockToast.info.mockClear();
  });

  it("renders all statement rows including 'Distributions Received'", async () => {
    renderWithProviders(<InvestorCapitalAccount />);

    await waitFor(() => {
      expect(screen.getByText("Capital Account Statement")).toBeInTheDocument();
    });

    expect(screen.getByText("Opening Balance")).toBeInTheDocument();
    expect(screen.getByText("Contributions")).toBeInTheDocument();
    expect(screen.getByText("Return of Capital Received")).toBeInTheDocument();
    expect(screen.getByText("Preferred Return Accrued")).toBeInTheDocument();
    expect(screen.getByText("Distributions Received")).toBeInTheDocument();
    expect(screen.getByText("Residual Allocation")).toBeInTheDocument();
    expect(screen.getByText("Closing Balance")).toBeInTheDocument();
  });

  it("renders the distributions received amount correctly", async () => {
    renderWithProviders(<InvestorCapitalAccount />);

    await waitFor(() => {
      expect(screen.getByText("Distributions Received")).toBeInTheDocument();
    });

    // $75,000.00 formatted with 2 decimal places
    expect(screen.getByText("$75,000.00")).toBeInTheDocument();
  });

  it("calls exportCapitalAccount service on Export Statement click (no alert)", async () => {
    // The Export button used to call alert(); it now delegates to the service
    // which does a blob download. Verify the service is called and alert isn't.
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    renderWithProviders(<InvestorCapitalAccount />);

    await waitFor(() => {
      expect(screen.getByText("Export Statement")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Export Statement"));

    expect(alertSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(vi.mocked(exportCapitalAccount)).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });

  it("renders empty state when no capital account data exists", async () => {
    vi.mocked(getInvestorCapitalAccount).mockResolvedValue({
      data: null,
      meta: { requestId: "r2", timestamp: "2025-01-15T10:00:00Z" },
    } as any);

    renderWithProviders(<InvestorCapitalAccount />);

    await waitFor(() => {
      expect(screen.getByText("No capital account data available yet")).toBeInTheDocument();
    });
  });
});
