import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { QUERY_KEYS, DEFAULT_FUND_CODE } from '@/config/constants';
import { getCapTable } from '@/services';
import type { CapTableRow } from '@/services/ownership.service';
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";

const OWNERSHIP_COLORS = ['#4338ca', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'] as const;

const fmt = (n: number) => n === 0 ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<CapTableRow>[] = [
  { key: "investorName", header: "Investor", render: (r) => r.investorName ?? "—" },
  { key: "walletAddress", header: "Wallet", render: (r) => <ExplorerLink value={r.walletAddress} type="address" /> },
  { key: "pendingAllocationPct", header: "Pending %", render: (r) => r.pendingAllocationPct > 0 ? `${r.pendingAllocationPct}%` : "—" },
  { key: "settledTokenBalance", header: "Settled Balance", render: (r) => fmt(parseFloat(r.settledTokenBalance)) },
  { key: "ownershipPct", header: "Ownership %", render: (r) => `${r.ownershipPct.toFixed(1)}%` },
];

/* ── Ownership Pie Chart ── */

interface OwnershipPieProps {
  readonly rows: ReadonlyArray<CapTableRow>;
}

function OwnershipPieChart({ rows }: OwnershipPieProps) {
  const chartData = useMemo(
    () => rows.map((r) => ({ name: r.investorName ?? "Unknown", value: Number(r.ownershipPct.toFixed(1)) })),
    [rows],
  );

  return (
    <SectionCard title="Ownership Distribution">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            paddingAngle={2}
          >
            {chartData.map((entry, idx) => (
              <Cell key={entry.name} fill={OWNERSHIP_COLORS[idx % OWNERSHIP_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value}%`, "Ownership"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => <span className="text-sm text-gray-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

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
      <OwnershipPieChart rows={rows} />

      <SectionCard>
        <DataTable columns={columns} data={rows} getRowId={(r) => r.investorId ?? r.walletAddress} />
      </SectionCard>
    </div>
  );
}
