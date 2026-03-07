import { useState } from "react";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { subscriptions, Subscription } from "@/data/mockData";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<Subscription>[] = [
  { key: "ref", header: "Ref" },
  { key: "investorName", header: "Investor" },
  { key: "allocation", header: "Allocation %", render: (r) => `${r.allocation}%` },
  { key: "committedAmount", header: "Committed", render: (r) => fmt(r.committedAmount) },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "lpaHash", header: "LPA Hash", className: "font-mono text-xs" },
  { key: "timestamp", header: "Date", render: (r) => new Date(r.timestamp).toLocaleDateString() },
];

export default function SubscriptionsPage() {
  const [selected, setSelected] = useState<Subscription | null>(null);
  const selectedId = selected?.id;

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
                  ["Date", new Date(selected.timestamp).toLocaleString()],
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
