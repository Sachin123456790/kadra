import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, Tooltip as PieTooltip,
} from "recharts";
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getMyDashboard } from "@/services";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import type { InvestorDashboard as DashboardData } from "@/services/investor-portal.service";

const CAPITAL_COLORS: Record<string, string> = {
  "Initial Contribution": "#312e81",   // indigo-700 equivalent
  "Capital Returned": "#16a34a",       // green-600
  "Accrued Pref Return": "#60a5fa",    // blue-400
  "Ending Balance": "#6366f1",         // indigo-500
};

const OWNERSHIP_BLUES = ["#4338ca", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"];

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
  { key: "walletAddress", header: "Wallet", render: (r) => <ExplorerLink value={r.walletAddress ?? ""} type="address" /> },
  { key: "settledTokenBalance", header: "Settled Balance", render: (r) => fmt(Number(r.settledTokenBalance)) },
  { key: "ownershipPct", header: "Ownership %", render: (r) => `${r.ownershipPct.toFixed(1)}%` },
];

export default function InvestorDashboardPage() {
  const fundId = DEFAULT_FUND_CODE;

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorDashboard(fundId),
    queryFn: () => getMyDashboard(fundId).then((r) => r.data),
  });

  const summary = data?.summary;
  const subscriptions = data?.subscriptions ?? [];
  const tokenPositions = data?.tokenPositions ?? [];
  const capitalAccount = data?.capitalAccount;

  const capitalBarData = useMemo(() => {
    if (!capitalAccount) return [];
    return [
      { name: "Initial Contribution", value: Number(capitalAccount.initialContribution) },
      { name: "Capital Returned", value: Number(capitalAccount.capitalReturned) },
      { name: "Accrued Pref Return", value: Number(capitalAccount.accruedPref) },
      { name: "Ending Balance", value: Number(capitalAccount.endingCapitalBalance) },
    ];
  }, [capitalAccount]);

  const ownershipPieData = useMemo(() => {
    if (!tokenPositions || tokenPositions.length === 0) return [];
    return tokenPositions.map((pos) => ({
      name: pos.walletAddress
        ? `${pos.walletAddress.slice(0, 6)}...${pos.walletAddress.slice(-4)}`
        : "Unknown",
      value: Number(pos.settledTokenBalance),
      fullAddress: pos.walletAddress,
    }));
  }, [tokenPositions]);

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load portfolio" message={(error as Error).message} />;
  if (!data || !summary) return <EmptyState title="No portfolio data" message="Your portfolio overview is not available yet." />;

  return (
    <div>
      <PageHeader title="Portfolio Overview" subtitle="Your investment summary" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Committed" value={fmt(Number(summary.totalCommitted))} />
        <MetricCard label="Total Settled" value={fmt(Number(summary.totalSettled))} />
        <MetricCard label="Token Balance" value={fmt(Number(summary.tokenBalance))} />
        <MetricCard label="Ownership" value={`${summary.ownershipPct.toFixed(1)}%`} />
      </div>

      {(capitalBarData.length > 0 || ownershipPieData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {capitalBarData.length > 0 && (
            <SectionCard title="Capital Account Breakdown">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={capitalBarData} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                  <XAxis type="number" tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                  <RechartsTooltip formatter={(value: number) => fmt(value)} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {capitalBarData.map((entry) => (
                      <Cell key={entry.name} fill={CAPITAL_COLORS[entry.name] ?? "#4338ca"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
          {ownershipPieData.length > 0 && (
            <SectionCard title="Token Ownership">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={ownershipPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                  >
                    {ownershipPieData.map((_, i) => (
                      <Cell key={i} fill={OWNERSHIP_BLUES[i % OWNERSHIP_BLUES.length]} />
                    ))}
                  </Pie>
                  <PieTooltip formatter={(value: number) => fmt(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
        </div>
      )}

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
