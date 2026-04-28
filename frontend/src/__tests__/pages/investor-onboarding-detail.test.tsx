import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  getDocuments: vi.fn(),
  updateInvestorVerification: vi.fn(),
  linkInvestorWallet: vi.fn(),
  updateInvestorEligibility: vi.fn(),
}));

vi.mock("@/services/ownership.service", () => ({
  getCapTable: vi.fn(),
  getCapitalAccounts: vi.fn(),
}));

import InvestorOnboardingDetailPage from "@/pages/InvestorOnboardingDetailPage";
import {
  getDocuments,
  getInvestors,
  getSubscriptions,
  updateInvestorVerification,
} from "@/services";
import { getCapTable, getCapitalAccounts } from "@/services/ownership.service";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/investors/inv-1/onboarding"]}>
      <QueryClientProvider client={createQueryClient()}>
        <Routes>
          <Route
            path="/investors/:investorId/onboarding"
            element={<InvestorOnboardingDetailPage />}
          />
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
        stages: [
          { key: "account", order: 1, label: "Account created", state: "complete", actor: "system" },
          { key: "profile", order: 2, label: "Profile & tax info", state: "complete", actor: "investor" },
          { key: "kyc", order: 3, label: "KYC verified", state: "current", actor: "admin" },
          { key: "accreditation", order: 4, label: "Accreditation confirmed", state: "pending", actor: "admin" },
          { key: "wallet", order: 5, label: "Wallet linked", state: "pending", actor: "investor" },
          { key: "eligibility", order: 6, label: "Fund eligibility approved", state: "pending", actor: "admin" },
        ],
      },
    },
  ],
  meta: { requestId: "req-1", timestamp: "2026-04-21T00:00:00Z" },
};

describe("InvestorOnboardingDetailPage", () => {
  beforeEach(() => {
    vi.mocked(getInvestors).mockResolvedValue(investorsResponse as any);
    vi.mocked(getSubscriptions).mockResolvedValue({
      data: [
        {
          subscriptionId: "sub-1",
          subscriptionRef: "SUB-001",
          investorId: "inv-1",
          investorName: "New Investor LLC",
          walletId: "wallet-1",
          allocationPct: 12.5,
          committedAmount: "250000",
          status: "PENDING",
          settledAt: null,
          createdAt: "2026-04-20T10:00:00Z",
          governingHashHex: null,
          latestSettlementStatus: null,
          settlementTxHash: null,
        },
      ],
      meta: {},
    } as any);
    vi.mocked(getDocuments).mockResolvedValue({
      data: [{ id: "doc-1", metadata: { investorId: "inv-1" }, uploadedBy: "new@example.com" }],
      meta: {},
    } as any);
    vi.mocked(getCapTable).mockResolvedValue({
      data: {
        rows: [
          {
            investorId: "inv-1",
            investorName: "New Investor LLC",
            walletAddress: "0x123",
            pendingAllocationPct: 12.5,
            settledTokenBalance: "0",
            ownershipPct: 0,
          },
        ],
      },
      meta: {},
    } as any);
    vi.mocked(getCapitalAccounts).mockResolvedValue({
      data: [
        {
          id: "ca-1",
          investorId: "inv-1",
          openingBalance: "0",
          initialContribution: "100000",
          capitalReturned: "0",
          accruedPreferredReturn: "0",
          endingBalance: "100000",
          asOfDate: "2026-04-20",
        },
      ],
      meta: {},
    } as any);
    vi.mocked(updateInvestorVerification).mockResolvedValue({
      data: {
        investorId: "inv-1",
        verificationStatus: "UNKNOWN",
        kycStatus: "APPROVED",
        accreditationStatus: "PENDING",
      },
      meta: {},
    } as any);
  });

  it("renders the former modal sections on the detail page", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Compliance Flags")).toBeInTheDocument();
    });

    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Admin Actions")).toBeInTheDocument();
    expect(screen.getByText("Capital Account")).toBeInTheDocument();
    expect(screen.getByText("Subscriptions")).toBeInTheDocument();
    expect(screen.getByText("Technical Details")).toBeInTheDocument();
    expect(screen.getByText("1 document")).toBeInTheDocument();
    expect(screen.getByText("Unaccredited")).toBeInTheDocument();
  });

  it("updates KYC from the detail page admin actions", async () => {
    renderPage();

    const selects = await screen.findAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "APPROVED" } });

    await waitFor(() => {
      expect(updateInvestorVerification).toHaveBeenCalledWith("inv-1", {
        kycStatus: "APPROVED",
      });
    });
  });
});
