import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getSubscriptions } from "@/services";
import type { SubscriptionRow } from "@/types/api";

const STATUS_COLORS: Record<string, string> = {
  SETTLED: "#4f46e5",
  PENDING: "#fbbf24",
};

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<SubscriptionRow>[] = [
  { key: "ref", header: "Ref" },
  { key: "investorName", header: "Investor" },
  { key: "allocation", header: "Allocation %", render: (r) => `${r.allocation}%` },
  { key: "committedAmount", header: "Committed", render: (r) => fmt(r.committedAmount) },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "lpaHash", header: "LPA Hash", className: "font-mono text-xs" },
  { key: "createdAt", header: "Created", render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—" },
  { key: "timestamp", header: "Settled", render: (r) => r.timestamp ? new Date(r.timestamp).toLocaleDateString() : "—" },
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
        investorName: sub.investorName || sub.investorId,
        allocation: sub.allocationPct,
        committedAmount: Number(sub.committedAmount) || 0,
        status: sub.status,
        lpaHash: sub.governingHashHex || "—",
        timestamp: sub.settledAt ?? "",
        createdAt: sub.createdAt ?? "",
      })),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load subscriptions" message={(error as Error).message} />;
  const statusChartData = useMemo(() => {
    if (!subscriptions) return [];
    const counts: Record<string, number> = {};
    for (const sub of subscriptions) {
      const key = sub.status.toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [subscriptions]);

  if (!subscriptions || subscriptions.length === 0) return <EmptyState title="No subscriptions" message="No subscription records exist yet." />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader title="Subscriptions" subtitle="Track subscription commitments and settlement status" />
        <SectionCard className="w-full sm:w-72 flex-shrink-0">
          <h3 className="text-sm font-medium text-gray-500 mb-2 text-center">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={statusChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
              >
                {statusChartData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>
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
                  ["Created", selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—"],
                  ["Settled", selected.timestamp ? new Date(selected.timestamp).toLocaleString() : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                    <dt className="text-sm text-gray-500">{k}</dt>
                    <dd className="text-sm font-medium text-gray-900">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center">Select a subscription to view details</p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
