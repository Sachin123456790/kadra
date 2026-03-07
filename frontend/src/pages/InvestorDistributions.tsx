import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getMyDistributions } from "@/services";
import type { InvestorDistribution } from "@/services/investor-portal.service";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<InvestorDistribution>[] = [
  { key: "asOfTimestamp", header: "Run Date", render: (r) => new Date(r.asOfTimestamp).toLocaleDateString() },
  { key: "runStatus", header: "Status", render: (r) => <StatusBadge status={r.runStatus} /> },
  { key: "ownershipPctUsed", header: "Ownership %", render: (r) => `${r.ownershipPctUsed}%` },
  { key: "grossAmount", header: "Gross Amount", render: (r) => fmt(Number(r.grossAmount)) },
  { key: "netAmount", header: "Net Amount", render: (r) => fmt(Number(r.netAmount)) },
  { key: "currency", header: "Currency" },
];

export default function InvestorDistributionsPage() {
  const fundId = DEFAULT_FUND_CODE;

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorDistributions(fundId),
    queryFn: () => getMyDistributions(fundId).then((r) => r.data),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load distributions" message={(error as Error).message} />;
  if (!data || data.length === 0) {
    return (
      <div>
        <PageHeader title="My Distributions" subtitle="Your distribution history" />
        <EmptyState title="No distributions" message="No distributions have been issued to your account yet." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Distributions" subtitle="Your distribution history" />
      <SectionCard>
        <DataTable columns={columns} data={data} getRowId={(r) => r.distributionRunId} />
      </SectionCard>
    </div>
  );
}
