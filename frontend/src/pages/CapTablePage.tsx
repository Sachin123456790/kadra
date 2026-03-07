import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, DEFAULT_FUND_CODE } from '@/config/constants';
import { getCapTable } from '@/services';
import type { CapTableRow } from '@/services/ownership.service';
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";

const fmt = (n: number) => n === 0 ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<CapTableRow>[] = [
  { key: "investorName", header: "Investor", render: (r) => r.investorName ?? "—" },
  { key: "walletAddress", header: "Wallet", className: "font-mono text-xs" },
  { key: "pendingAllocationPct", header: "Pending %", render: (r) => r.pendingAllocationPct > 0 ? `${r.pendingAllocationPct}%` : "—" },
  { key: "settledTokenBalance", header: "Settled Balance", render: (r) => fmt(parseFloat(r.settledTokenBalance)) },
  { key: "ownershipPct", header: "Ownership %", render: (r) => `${r.ownershipPct.toFixed(1)}%` },
];

export default function CapTablePage() {
  const fundId = DEFAULT_FUND_CODE;

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.capTable(fundId),
    queryFn: () => getCapTable(fundId).then(r => r.data),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Cap Table Error" message={(error as Error).message} />;
  if (!data || data.rows.length === 0) return (
    <div>
      <PageHeader title="Cap Table" subtitle="Current ownership and allocation breakdown" />
      <EmptyState title="No cap table data" message="No ownership positions have been recorded yet." />
    </div>
  );

  const rows = data.rows;
  const totalOwnership = rows.reduce((s, e) => s + e.ownershipPct, 0);
  const totalSettled = rows.reduce((s, e) => s + parseFloat(e.settledTokenBalance), 0);
  const pendingCount = rows.filter(e => e.pendingAllocationPct > 0).length;

  return (
    <div>
      <PageHeader title="Cap Table" subtitle="Current ownership and allocation breakdown" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Investors" value={rows.length} />
        <MetricCard label="Total Ownership" value={`${totalOwnership.toFixed(1)}%`} />
        <MetricCard label="Settled Balance" value={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalSettled)} />
        <MetricCard label="Pending Allocations" value={pendingCount} />
      </div>
      <SectionCard>
        <DataTable columns={columns} data={rows} getRowId={(r) => r.investorId ?? r.walletAddress} />
      </SectionCard>
    </div>
  );
}
