import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/services", () => ({
  getInvestors: vi.fn(),
  getSubscriptions: vi.fn(),
}));

vi.mock("@/services/ownership.service", () => ({
  getCapTable: vi.fn(),
}));

import InvestorsPage from "@/pages/InvestorsPage";
import { getInvestors, getSubscriptions } from "@/services";
import { getCapTable } from "@/services/ownership.service";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/investors"]}>
      <QueryClientProvider client={createQueryClient()}>
        <Routes>
          <Route path="/investors" element={ui} />
          <Route path="/investors/:investorId/onboarding" element={<div>Investor detail page</div>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const investorsResponse = {
  data: [
    {
      investorId: "inv-1",
      legalName: "New Investor LLC",
      email: "new@example.com",
      verificationStatus: "UNKNOWN",
      kycStatus: "PENDING",
      accreditationStatus: "PENDING",
      wallets: [],
      fundEligibility: null,
      onboarding: {
        currentStage: "kyc",
        blockedOn: "kyc",
        completed: false,
        percentComplete: 33,
        stages: [],
      },
    },
    {
      investorId: "inv-2",
      legalName: "Seeded Investor LP",
      email: "seeded@example.com",
      verificationStatus: "VERIFIED",
      kycStatus: "APPROVED",
      accreditationStatus: "APPROVED",
      wallets: [
        {
          walletId: "wallet-1",
          address: "0x1234567890123456789012345678901234567890",
          chainId: 11155111,
          isPrimary: true,
          status: "ACTIVE",
        },
      ],
      fundEligibility: {
        eligibilityId: "elig-1",
        status: "ELIGIBLE",
        effectiveAt: "2025-01-01T00:00:00Z",
      },
      onboarding: {
        currentStage: null,
        blockedOn: null,
        completed: true,
        percentComplete: 100,
        stages: [],
      },
    },
  ],
  meta: { requestId: "req-1", timestamp: "2026-04-21T00:00:00Z" },
};

describe("InvestorsPage", () => {
  beforeEach(() => {
    vi.mocked(getInvestors).mockResolvedValue(investorsResponse as any);
    vi.mocked(getSubscriptions).mockResolvedValue({ data: [], meta: {} } as any);
    vi.mocked(getCapTable).mockResolvedValue({ data: { rows: [] }, meta: {} } as any);
  });

  it("shows investor list status fields before navigation", async () => {
    renderWithProviders(<InvestorsPage />);

    await waitFor(() => {
      expect(screen.getByText("New Investor LLC")).toBeInTheDocument();
    });

    const table = screen.getByRole("table");
    expect(within(table).getByText("Verified")).toBeInTheDocument();
    expect(within(table).getByText("Unaccredited")).toBeInTheDocument();
  });

  it("routes View to the investor detail page", async () => {
    renderWithProviders(<InvestorsPage />);

    await waitFor(() => {
      expect(screen.getByText("New Investor LLC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText("View")[0]);

    await waitFor(() => {
      expect(screen.getByText("Investor detail page")).toBeInTheDocument();
    });
  });
});
