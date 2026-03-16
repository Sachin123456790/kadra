import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getInvestorCapTable } from "@/services";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import type { InvestorCapTableRow } from "@/services/investor-portal.service";

const PIE_COLORS = ["#4338ca", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe", "#e0e7ff"];

const fmt = (n: number) =>
  n === 0
    ? "--"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<InvestorCapTableRow>[] = [
  { key: "investorName", header: "Investor", render: (r) => r.investorName ?? "--" },
  { key: "walletAddress", header: "Wallet", render: (r) => <ExplorerLink value={r.walletAddress ?? ""} type="address" /> },
  { key: "settledTokenBalance", header: "Settled Balance", render: (r) => fmt(parseFloat(r.settledTokenBalance)) },
  { key: "ownershipPct", header: "Ownership %", render: (r) => `${r.ownershipPct.toFixed(1)}%` },
];

interface PieEntry {
  name: string;
  value: number;
}

function OwnershipPieChart({ rows }: { rows: InvestorCapTableRow[] }) {
  const pieData: PieEntry[] = rows.map((r) => ({
    name: r.investorName ?? "Unknown",
    value: r.ownershipPct,
  }));

  return (
    <SectionCard>
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Fund Ownership</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, value }: PieEntry) => `${name} (${value.toFixed(1)}%)`}
          >
            {pieData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

export default function InvestorCapTablePage() {
  const fundId = DEFAULT_FUND_CODE;

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorCapTable(fundId),
    queryFn: () => getInvestorCapTable(fundId).then((r) => r.data),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Cap Table Error" message={(error as Error).message} />;
  if (!data || data.rows.length === 0) {
    return (
      <div>
        <PageHeader title="Cap Table" subtitle="Fund ownership distribution" />
        <EmptyState title="No cap table data" message="No ownership positions have been recorded yet." />
      </div>
    );
  }

  const rows = data.rows;
  const totalOwnership = rows.reduce((s, r) => s + r.ownershipPct, 0);
  const totalSettled = rows.reduce((s, r) => s + parseFloat(r.settledTokenBalance), 0);

  return (
    <div>
      <PageHeader title="Cap Table" subtitle="Fund ownership distribution" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Total Investors" value={rows.length} />
        <MetricCard label="Total Ownership" value={`${totalOwnership.toFixed(1)}%`} />
        <MetricCard
          label="Total Settled Balance"
          value={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalSettled)}
        />
      </div>
      <div className="mb-6">
        <OwnershipPieChart rows={rows} />
      </div>
      <SectionCard>
        <DataTable columns={columns} data={rows} getRowId={(r) => r.investorId ?? r.walletAddress} />
      </SectionCard>
    </div>
  );
}
