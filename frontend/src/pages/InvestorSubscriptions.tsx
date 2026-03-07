import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getMySubscriptions } from "@/services";
import type { InvestorSubscription } from "@/services/investor-portal.service";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<InvestorSubscription>[] = [
  { key: "subscriptionRef", header: "Ref" },
  { key: "allocationPct", header: "Allocation %", render: (r) => `${r.allocationPct}%` },
  { key: "committedAmount", header: "Committed", render: (r) => fmt(Number(r.committedAmount)) },
  { key: "currency", header: "Currency" },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "latestSettlementStatus", header: "Settlement", render: (r) => r.latestSettlementStatus ? <StatusBadge status={r.latestSettlementStatus} /> : <span className="text-muted-foreground">--</span> },
  { key: "settledAt", header: "Settled At", render: (r) => r.settledAt ? new Date(r.settledAt).toLocaleDateString() : "--" },
];

export default function InvestorSubscriptionsPage() {
  const fundId = DEFAULT_FUND_CODE;

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorSubscriptions(fundId),
    queryFn: () => getMySubscriptions(fundId).then((r) => r.data),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load subscriptions" message={(error as Error).message} />;
  if (!data || data.length === 0) {
    return (
      <div>
        <PageHeader title="My Subscriptions" subtitle="Your subscription commitments and settlement status" />
        <EmptyState title="No subscriptions" message="You have no subscription records yet." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Subscriptions" subtitle="Your subscription commitments and settlement status" />
      <SectionCard>
        <DataTable columns={columns} data={data} getRowId={(r) => r.id} />
      </SectionCard>
    </div>
  );
}
