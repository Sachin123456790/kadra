import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getInvestors } from "@/services";
import type { InvestorRow } from "@/types/api";

const columns: Column<InvestorRow>[] = [
  { key: "name", header: "Investor Name" },
  { key: "wallet", header: "Wallet Address", className: "font-mono text-xs" },
  { key: "verificationStatus", header: "Status", render: (r) => <StatusBadge status={r.verificationStatus} /> },
  { key: "fundEligibility", header: "Fund Eligibility" },
  { key: "ownership", header: "Ownership %", render: (r) => `${r.ownership}%` },
  { key: "actions", header: "Actions", render: () => <button className="text-xs text-primary font-medium hover:underline">View</button> },
];

export default function InvestorsPage() {
  const fundId = DEFAULT_FUND_CODE;

  const { data: investors, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investors(fundId),
    queryFn: () => getInvestors(fundId).then(r => r.data),
    select: (data): InvestorRow[] =>
      data.map((inv) => ({
        id: inv.investorId,
        name: inv.legalName,
        wallet: inv.wallets?.[0]?.address ?? "No wallet linked",
        verificationStatus: inv.verificationStatus,
        fundEligibility: inv.fundEligibility?.status ?? "N/A",
        ownership: 0, // ownership % comes from cap table, not investor endpoint
      })),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load investors" message={(error as Error).message} />;
  if (!investors || investors.length === 0) return <EmptyState title="No investors" message="No investors have been registered yet." />;

  return (
    <div>
      <PageHeader title="Investors" subtitle="Manage fund investors and verification status" />
      <SectionCard>
        <DataTable columns={columns} data={investors} getRowId={(r) => r.id} />
      </SectionCard>
    </div>
  );
}
