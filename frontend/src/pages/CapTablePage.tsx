import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { capTable, CapTableEntry } from "@/data/mockData";

const fmt = (n: number) => n === 0 ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<CapTableEntry>[] = [
  { key: "investorName", header: "Investor" },
  { key: "wallet", header: "Wallet", className: "font-mono text-xs" },
  { key: "pendingAllocation", header: "Pending %", render: (r) => r.pendingAllocation > 0 ? `${r.pendingAllocation}%` : "—" },
  { key: "settledTokenBalance", header: "Settled Balance", render: (r) => fmt(r.settledTokenBalance) },
  { key: "ownership", header: "Ownership %", render: (r) => `${r.ownership}%` },
  { key: "lastUpdated", header: "Last Updated" },
];

const totalOwnership = capTable.reduce((s, e) => s + e.ownership, 0);
const totalSettled = capTable.reduce((s, e) => s + e.settledTokenBalance, 0);

export default function CapTablePage() {
  return (
    <div>
      <PageHeader title="Cap Table" subtitle="Current ownership and allocation breakdown" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Investors" value={capTable.length} />
        <MetricCard label="Total Ownership" value={`${totalOwnership.toFixed(1)}%`} />
        <MetricCard label="Settled Balance" value={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalSettled)} />
        <MetricCard label="Pending Allocations" value={capTable.filter(e => e.pendingAllocation > 0).length} />
      </div>
      <SectionCard>
        <DataTable columns={columns} data={capTable} getRowId={(r) => r.id} />
      </SectionCard>
    </div>
  );
}
