import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/hooks/useCurrentFund", () => ({
  useCurrentFund: () => ({
    waterfallConfig: {
      version: "1.0",
      prefReturnPct: 8,
      rules: {
        tiers: [
          { name: "Return of Capital", hurdle: "NONE", lpShare: 100, gpShare: 0 },
        ],
      },
    },
  }),
}));

vi.mock("@/services", () => ({
  getMyDistributions: vi.fn(),
  getInvestorWaterfallBreakdown: vi.fn(),
}));

import InvestorDistributionsPage from "@/pages/InvestorDistributions";
import { getMyDistributions, getInvestorWaterfallBreakdown } from "@/services";

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

describe("InvestorDistributions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows fund-level distribution context even when the investor has no line items", async () => {
    vi.mocked(getMyDistributions).mockResolvedValue({
      data: [],
      meta: { requestId: "req-dist", timestamp: "2026-04-22T00:00:00Z" },
    } as any);
    vi.mocked(getInvestorWaterfallBreakdown).mockResolvedValue({
      data: {
        waterfallConfig: {
          id: "wf-1",
          version: "1.0",
        },
        distributionRun: {
          id: "run-1",
          runStatus: "COMPLETED",
          asOfTimestamp: "2026-03-10T15:47:15.000Z",
          completedAt: "2026-03-10T15:47:17.617Z",
        },
        lineItem: null,
      },
      meta: { requestId: "req-breakdown", timestamp: "2026-04-22T00:00:00Z" },
    } as any);

    renderWithProviders(<InvestorDistributionsPage />);

    await waitFor(() => {
      expect(screen.getByText("Waterfall Breakdown")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "The fund has a completed distribution run, but no payout line item was issued to your account in that run.",
      ),
    ).toBeInTheDocument();
  });
});
