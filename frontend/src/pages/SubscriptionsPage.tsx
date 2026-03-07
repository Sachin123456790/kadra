import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getSubscriptions } from "@/services";
import type { SubscriptionRow } from "@/types/api";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<SubscriptionRow>[] = [
  { key: "ref", header: "Ref" },
  { key: "investorName", header: "Investor" },
  { key: "allocation", header: "Allocation %", render: (r) => `${r.allocation}%` },
  { key: "committedAmount", header: "Committed", render: (r) => fmt(r.committedAmount) },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "lpaHash", header: "LPA Hash", className: "font-mono text-xs" },
  { key: "timestamp", header: "Date", render: (r) => r.timestamp ? new Date(r.timestamp).toLocaleDateString() : "—" },
];

export default function SubscriptionsPage() {
  const [selected, setSelected] = useState<SubscriptionRow | null>(null);
  const selectedId = selected?.id;
  const fundId = DEFAULT_FUND_CODE;

  const { data: subscriptions, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.subscriptions(fundId),
    queryFn: () => getSubscriptions(fundId).then(r => r.data),
    select: (data): SubscriptionRow[] =>
      data.map((sub) => ({
        id: sub.subscriptionId,
        ref: sub.subscriptionRef,
        investorId: sub.investorId,
        investorName: sub.investorId, // backend returns investorId; display as-is unless enriched
        allocation: sub.allocationPct,
        committedAmount: Number(sub.committedAmount) || 0,
        status: sub.status,
        lpaHash: "—", // governing hash not returned in list endpoint
        timestamp: sub.settledAt ?? "",
      })),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load subscriptions" message={(error as Error).message} />;
  if (!subscriptions || subscriptions.length === 0) return <EmptyState title="No subscriptions" message="No subscription records exist yet." />;

  return (
    <div>
      <PageHeader title="Subscriptions" subtitle="Track subscription commitments and settlement status" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <SectionCard>
            <DataTable columns={columns} data={subscriptions} onRowClick={(r) => setSelected(r)} selectedId={selectedId} getRowId={(r) => r.id} />
          </SectionCard>
        </div>
        <div>
          <SectionCard title="Subscription Details">
            {selected ? (
              <dl className="space-y-3">
                {[
                  ["Reference", selected.ref],
                  ["Investor", selected.investorName],
                  ["Allocation", `${selected.allocation}%`],
                  ["Committed", fmt(selected.committedAmount)],
                  ["Status", selected.status],
                  ["LPA Hash", selected.lpaHash],
                  ["Date", selected.timestamp ? new Date(selected.timestamp).toLocaleString() : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                    <dt className="text-sm text-muted-foreground">{k}</dt>
                    <dd className="text-sm font-medium text-card-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Select a subscription to view details</p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
