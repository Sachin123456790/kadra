import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import FundOverviewPage from "@/pages/FundOverview";
import { getActivityFeed, getDocuments, getFundOverview } from "@/services";
import {
  getCapitalCalls,
  type CapitalCall,
} from "@/services/capital-calls.service";
import {
  displayMoney,
  issuedCapital,
  recordedAmount,
} from "@/lib/fund-overview";

vi.mock("@/services", () => ({
  getActivityFeed: vi.fn(),
  getDocuments: vi.fn(),
  getFundOverview: vi.fn(),
}));
vi.mock("@/services/capital-calls.service", () => ({
  getCapitalCalls: vi.fn(),
}));
vi.mock("@/hooks/useAppConfig", () => ({
  useAppConfig: () => ({ data: undefined }),
}));
const meta = { requestId: "test", timestamp: "2026-11-01T12:00:00Z" };
const call = (status: string, amountDue = "100") =>
  ({
    id: status,
    fundId: "test",
    callNumber: 1,
    amountDue,
    dueDate: "2026-11-15",
    wireInstructions: null,
    status,
    createdAt: meta.timestamp,
  }) satisfies CapitalCall;

describe("dashboard financial display", () => {
  it("distinguishes missing amounts from recorded zero", () => {
    for (const missing of [undefined, null, "", " ", "not-a-number", Infinity])
      expect(recordedAmount(missing)).toBeNull();
    expect(recordedAmount("0")).toBe(0);
    expect(displayMoney(null)).toBe("—");
    expect(displayMoney(0)).toBe("$0.00");
  });
  it("excludes drafts and cancelled calls from issued capital", () => {
    expect(
      issuedCapital([
        call("ISSUED"),
        call("CLOSED", "200"),
        call("DRAFT", "500"),
        call("CANCELLED", "700"),
      ]),
    ).toBe(300);
    expect(issuedCapital(undefined)).toBeNull();
    expect(issuedCapital([call("ISSUED", "invalid")])).toBeNull();
    expect(issuedCapital([])).toBe(0);
  });
  it("does not present incomplete attention checks as clear or settled capital as NAV", async () => {
    vi.mocked(getFundOverview).mockResolvedValue({
      meta,
      data: {
        fundId: "test",
        fundName: "Test Fund",
        status: "ACTIVE",
        lpCount: 5,
        eligibleWalletCount: 0,
        pendingSubscriptions: 0,
        settledSubscriptions: 0,
        targetCommitment: "1000",
        totalCommittedAmount: "800",
        totalSettledAmount: "500",
        tokenContract: null,
      },
    });
    vi.mocked(getActivityFeed).mockResolvedValue({ meta, data: [] });
    vi.mocked(getDocuments).mockResolvedValue({ meta, data: [] });
    vi.mocked(getCapitalCalls).mockRejectedValue(new Error("Unavailable"));
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <FundOverviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "GP Dashboard" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Attention checks are incomplete",
    );
    expect(screen.queryByText(/No pending items/)).not.toBeInTheDocument();
    expect(
      screen.getByText("NAV", { selector: "dt" }).nextElementSibling,
    ).toHaveTextContent("—");
    expect(
      screen.getByRole("link", { name: "Add source documents" }),
    ).toHaveAttribute("href", "/documents?tab=upload");
  });
});
