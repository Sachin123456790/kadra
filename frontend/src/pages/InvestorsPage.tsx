import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/angainor/PageHeader";
import { SectionCard } from "@/components/angainor/SectionCard";
import { DataTable, Column } from "@/components/angainor/DataTable";
import { ErrorAlert } from "@/components/angainor/ErrorAlert";
import { EmptyState } from "@/components/angainor/EmptyState";
import { TableSkeleton } from "@/components/angainor/Skeleton";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getInvestors, getSubscriptions } from "@/services";
import { getCapTable } from "@/services/ownership.service";
import { Search, UserPlus, Wallet } from "lucide-react";
import type { Investor } from "@/services/investors.service";
import { InviteInvestorModal } from "@/components/angainor/InviteInvestorModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InvestorTableRow {
  id: string;
  name: string;
  email: string;
  wallet: string;
  verificationStatus: string;
  fundEligibility: string;
  ownership: number;
  kycStatus: string;
  accreditationStatus: string;
  eligibilityOnChain: string;
  settlementStatus: string;
  lastActivity: string;
  sortKey: number;
}

function deriveSettlementStatus(
  investorId: string,
  subscriptions: Array<{ investorId: string; status: string }> | undefined,
): string {
  if (!subscriptions) return "Not Started";
  const investorSubs = subscriptions.filter((s) => s.investorId === investorId);
  if (investorSubs.length === 0) return "Not Started";
  if (investorSubs.every((s) => s.status === "SETTLED")) return "Settled";
  if (investorSubs.some((s) => s.status === "SETTLED" || s.status === "PENDING")) {
    return "Pending";
  }
  return "Not Started";
}

function deriveLastActivity(
  investor: Investor,
  subscriptions: Array<{ investorId: string; settledAt: string | null; createdAt: string | null }> | undefined,
): string {
  const timestamps: number[] = [];

  if (investor.fundEligibility?.effectiveAt) {
    timestamps.push(new Date(investor.fundEligibility.effectiveAt).getTime());
  }

  if (subscriptions) {
    for (const sub of subscriptions.filter((s) => s.investorId === investor.investorId)) {
      if (sub.settledAt) timestamps.push(new Date(sub.settledAt).getTime());
      if (sub.createdAt) timestamps.push(new Date(sub.createdAt).getTime());
    }
  }

  if (timestamps.length === 0) return "";
  return new Date(Math.max(...timestamps)).toLocaleDateString();
}

export default function InvestorsPage() {
  const navigate = useNavigate();
  const fundId = DEFAULT_FUND_CODE;
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: rawInvestors, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investors(fundId),
    queryFn: () => getInvestors(fundId).then((r) => r.data),
  });

  const { data: capTable } = useQuery({
    queryKey: QUERY_KEYS.capTable(fundId),
    queryFn: () => getCapTable(fundId).then((r) => r.data),
  });

  const { data: allSubscriptions } = useQuery({
    queryKey: QUERY_KEYS.subscriptions(fundId),
    queryFn: () => getSubscriptions(fundId).then((r) => r.data),
  });

  const allInvestors: InvestorTableRow[] | undefined = rawInvestors?.map((inv) => {
    const ownership = capTable?.rows?.find((r) => r.investorId === inv.investorId);
    const isKycApproved = inv.kycStatus === "APPROVED";
    const isAccredited = inv.accreditationStatus === "APPROVED";
    const eligibilityStatus = inv.fundEligibility?.status ?? "N/A";
    const isEligible = eligibilityStatus === "APPROVED" || eligibilityStatus === "ELIGIBLE";
    const createdAtMs = inv.createdAt ? new Date(inv.createdAt).getTime() : 0;

    return {
      id: inv.investorId,
      name: inv.legalName,
      email: inv.email,
      wallet: inv.wallets?.[0]?.address ?? "No wallet linked",
      verificationStatus: inv.verificationStatus,
      fundEligibility: eligibilityStatus,
      ownership: ownership?.ownershipPct ?? 0,
      kycStatus: isKycApproved ? "Verified" : "Unverified",
      accreditationStatus: isAccredited ? "Accredited" : "Unaccredited",
      eligibilityOnChain: isEligible ? "Yes" : "No",
      settlementStatus: deriveSettlementStatus(inv.investorId, allSubscriptions),
      lastActivity: deriveLastActivity(inv, allSubscriptions),
      sortKey: createdAtMs,
    };
  });

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const investors = allInvestors
    ?.filter((row) => {
      if (!trimmedQuery) return true;
      return (
        row.name.toLowerCase().includes(trimmedQuery) ||
        row.email.toLowerCase().includes(trimmedQuery) ||
        row.wallet.toLowerCase().includes(trimmedQuery)
      );
    })
    .slice()
    .sort((a, b) => b.sortKey - a.sortKey);

  const columns: Column<InvestorTableRow>[] = [
    { key: "name", header: "Investor Name" },
    {
      key: "wallet",
      header: "Wallet",
      render: (r) =>
        r.wallet !== "No wallet linked" ? (
          <Wallet className="h-4 w-4 text-muted-foreground" />
        ) : (
          <span className="text-xs text-gray-400">--</span>
        ),
    },
    {
      key: "kycStatus",
      header: "KYC Status",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            r.kycStatus === "Verified"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {r.kycStatus}
        </span>
      ),
    },
    {
      key: "accreditationStatus",
      header: "Accreditation",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            r.accreditationStatus === "Accredited"
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {r.accreditationStatus}
        </span>
      ),
    },
    {
      key: "eligibilityOnChain",
      header: "Eligibility",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            r.eligibilityOnChain === "Yes"
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-muted-foreground"
          }`}
        >
          {r.eligibilityOnChain}
        </span>
      ),
    },
    {
      key: "ownership",
      header: "Ownership %",
      render: (r) => (
        <span className="text-sm text-foreground">
          {r.ownership > 0 ? `${r.ownership}%` : "--"}
        </span>
      ),
    },
    {
      key: "settlementStatus",
      header: "Settlement",
      render: (r) => {
        const colorMap: Record<string, string> = {
          Settled: "bg-green-50 text-green-700",
          Pending: "bg-amber-50 text-amber-700",
          "Not Started": "bg-gray-100 text-muted-foreground",
        };
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[r.settlementStatus] ?? "bg-gray-100 text-muted-foreground"}`}
          >
            {r.settlementStatus}
          </span>
        );
      },
    },
    {
      key: "lastActivity",
      header: "Last Activity",
      render: (r) => (
        <span className="text-xs text-muted-foreground">{r.lastActivity || "--"}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <button
          onClick={() => navigate(`/investors/${r.id}/onboarding`)}
          className="text-xs text-primary font-medium hover:underline"
        >
          View
        </button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <TableSkeleton rows={6} columns={8} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorAlert title="Failed to load investors" message={(error as Error).message} />
    );
  }

  if (!allInvestors || allInvestors.length === 0) {
    return (
      <EmptyState
        title="No investors registered"
        message="Add investors to begin the onboarding process."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Investors"
        subtitle="Manage fund investors and verification status"
        action={
          <Button
            onClick={() => setInviteOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Investor
          </Button>
        }
      />
      <SectionCard>
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or wallet…"
              className="pl-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {investors?.length ?? 0} of {allInvestors.length}
          </span>
        </div>
        {investors && investors.length > 0 ? (
          <DataTable columns={columns} data={investors} getRowId={(r) => r.id} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No investors match &ldquo;{searchQuery}&rdquo;.
          </p>
        )}
      </SectionCard>

      <InviteInvestorModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        fundId={fundId}
      />
    </div>
  );
}
