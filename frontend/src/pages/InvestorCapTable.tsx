import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getInvestorCapTable } from "@/services";
import type { InvestorCapTableRow } from "@/services/investor-portal.service";

const fmt = (n: number) =>
  n === 0
    ? "--"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<InvestorCapTableRow>[] = [
  { key: "investorName", header: "Investor", render: (r) => r.investorName ?? "--" },
  { key: "walletAddress", header: "Wallet", className: "font-mono text-xs" },
  { key: "settledTokenBalance", header: "Settled Balance", render: (r) => fmt(parseFloat(r.settledTokenBalance)) },
  { key: "ownershipPct", header: "Ownership %", render: (r) => `${r.ownershipPct.toFixed(1)}%` },
];

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
      <SectionCard>
        <DataTable columns={columns} data={rows} getRowId={(r) => r.investorId ?? r.walletAddress} />
      </SectionCard>
    </div>
  );
}
