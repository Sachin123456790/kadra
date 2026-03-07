import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getMyDashboard } from "@/services";
import type { InvestorDashboard as DashboardData } from "@/services/investor-portal.service";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

type SubRow = DashboardData["subscriptions"][number];
type PosRow = DashboardData["tokenPositions"][number];

const subCols: Column<SubRow>[] = [
  { key: "subscriptionRef", header: "Reference" },
  { key: "allocationPct", header: "Allocation %", render: (r) => `${r.allocationPct}%` },
  { key: "committedAmount", header: "Committed", render: (r) => fmt(Number(r.committedAmount)) },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
];

const posCols: Column<PosRow>[] = [
  { key: "walletAddress", header: "Wallet", className: "font-mono text-xs" },
  { key: "settledTokenBalance", header: "Settled Balance", render: (r) => fmt(Number(r.settledTokenBalance)) },
  { key: "ownershipPct", header: "Ownership %", render: (r) => `${r.ownershipPct.toFixed(1)}%` },
];

export default function InvestorDashboardPage() {
  const fundId = DEFAULT_FUND_CODE;

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorDashboard(fundId),
    queryFn: () => getMyDashboard(fundId).then((r) => r.data),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load portfolio" message={(error as Error).message} />;
  if (!data) return <EmptyState title="No portfolio data" message="Your portfolio overview is not available yet." />;

  const { summary, subscriptions, tokenPositions, capitalAccount } = data;

  return (
    <div>
      <PageHeader title="Portfolio Overview" subtitle="Your investment summary" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Committed" value={fmt(Number(summary.totalCommitted))} />
        <MetricCard label="Total Settled" value={fmt(Number(summary.totalSettled))} />
        <MetricCard label="Token Balance" value={fmt(Number(summary.tokenBalance))} />
        <MetricCard label="Ownership" value={`${summary.ownershipPct.toFixed(1)}%`} />
      </div>

      <SectionCard title="Subscriptions" className="mb-6">
        {subscriptions.length === 0 ? (
          <EmptyState title="No subscriptions" message="You have no active subscriptions." />
        ) : (
          <DataTable columns={subCols} data={subscriptions} getRowId={(r) => r.id} />
        )}
      </SectionCard>

      <SectionCard title="Token Positions" className="mb-6">
        {tokenPositions.length === 0 ? (
          <EmptyState title="No positions" message="You have no settled positions yet." />
        ) : (
          <DataTable columns={posCols} data={tokenPositions} getRowId={(r) => r.id} />
        )}
      </SectionCard>

      {capitalAccount && (
        <SectionCard title="Capital Account">
          <dl className="space-y-3">
            {([
              ["Opening Balance", fmt(Number(capitalAccount.openingBalance))],
              ["Initial Contribution", fmt(Number(capitalAccount.initialContribution))],
              ["Capital Returned", fmt(Number(capitalAccount.capitalReturned))],
              ["Accrued Preferred Return", fmt(Number(capitalAccount.accruedPref))],
              ["Ending Balance", fmt(Number(capitalAccount.endingCapitalBalance))],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium text-card-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      )}
    </div>
  );
}
