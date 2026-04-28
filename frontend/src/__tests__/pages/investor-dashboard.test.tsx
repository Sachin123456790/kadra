import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react-router-dom", () => ({
  Navigate: ({ to }: { to: string }) => <div>Navigate:{to}</div>,
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/hooks/useCurrentFund", () => ({
  useCurrentFund: () => ({
    fund: { fundName: "Angainor Demo Fund I" },
  }),
}));

vi.mock("@/hooks/useAppConfig", () => ({
  useAppConfig: () => ({
    data: {
      defaults: {
        fundName: "Angainor Demo Fund I",
      },
    },
  }),
}));

vi.mock("@/services/investor-portal.service", () => ({
  getMyDashboard: vi.fn(),
  getInvestorActivityFeed: vi.fn(),
  getInvestorCapitalAccount: vi.fn(),
  getMyDistributions: vi.fn(),
}));

vi.mock("@/services/onboarding.service", () => ({
  getMyOnboarding: vi.fn(),
}));

import InvestorDashboardPage from "@/pages/InvestorDashboard";
import {
  getMyDashboard,
  getInvestorActivityFeed,
  getInvestorCapitalAccount,
  getMyDistributions,
} from "@/services/investor-portal.service";
import { getMyOnboarding } from "@/services/onboarding.service";

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

describe("InvestorDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getMyOnboarding).mockResolvedValue({
      data: { completed: true },
      meta: { requestId: "req-onboarding", timestamp: "2025-01-01T00:00:00Z" },
    } as any);
    vi.mocked(getInvestorCapitalAccount).mockResolvedValue({
      data: {
        id: "ca-1",
        openingBalance: "0",
        initialContribution: "1000000",
        capitalReturned: "0",
        accruedPreferredReturn: "25000",
        residualAllocation: "0",
        endingBalance: "1025000",
        asOfDate: "2025-01-01T00:00:00Z",
      },
      meta: { requestId: "req-ca", timestamp: "2025-01-01T00:00:00Z" },
    } as any);
    vi.mocked(getMyDistributions).mockResolvedValue({
      data: [],
      meta: { requestId: "req-dist", timestamp: "2025-01-01T00:00:00Z" },
    } as any);
    vi.mocked(getInvestorActivityFeed).mockResolvedValue({
      data: [],
      meta: { requestId: "req-activity", timestamp: "2025-01-01T00:00:00Z" },
    } as any);
    vi.mocked(getMyDashboard).mockResolvedValue({
      data: {
        summary: {
          ownershipPct: 12.5,
          totalCommitted: "1000000",
          totalSettled: "1000000",
        },
        investor: {
          id: "inv-1",
          legalName: "Alpine Capital",
          email: "alpine@example.com",
          verificationStatus: "VERIFIED",
        },
        subscriptions: [
          {
            id: "sub-1",
            subscriptionRef: "SUB-001",
            allocationPct: 12.5,
            committedAmount: "1000000",
            currency: "USD",
            status: "SETTLED",
            settledAt: "2025-01-01T00:00:00Z",
            latestSettlementStatus: "SETTLED",
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
      },
      meta: { requestId: "req-dashboard", timestamp: "2025-01-01T00:00:00Z" },
    } as any);
  });

  it("treats uppercase backend subscription statuses as settled in the portfolio summary", async () => {
    renderWithProviders(<InvestorDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Portfolio Summary")).toBeInTheDocument();
    });

    expect(screen.getByText("Settlement Status")).toBeInTheDocument();
    expect(screen.getByText("Settled")).toBeInTheDocument();
  });
});
