import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getMyTransfers } from "@/services";
import type { InvestorTransfer } from "@/services/investor-portal.service";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<InvestorTransfer>[] = [
  {
    key: "direction",
    header: "Direction",
    render: (r) => (
      <StatusBadge
        status={r.direction === "sent" ? "Sent" : "Received"}
        className={r.direction === "sent" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}
      />
    ),
  },
  { key: "counterpartyAddress", header: "Counterparty", className: "font-mono text-xs" },
  { key: "tokenAmount", header: "Amount", render: (r) => fmt(Number(r.tokenAmount)) },
  { key: "requestStatus", header: "Status", render: (r) => <StatusBadge status={r.requestStatus} /> },
  { key: "txHash", header: "Tx Hash", className: "font-mono text-xs", render: (r) => r.txHash || "--" },
  { key: "timestamp", header: "Date", render: (r) => new Date(r.timestamp).toLocaleDateString() },
];

export default function InvestorTransfersPage() {
  const fundId = DEFAULT_FUND_CODE;

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorTransfers(fundId),
    queryFn: () => getMyTransfers(fundId).then((r) => r.data),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load transfers" message={(error as Error).message} />;
  if (!data || data.length === 0) {
    return (
      <div>
        <PageHeader title="My Transfers" subtitle="Your transfer history" />
        <EmptyState title="No transfers" message="You have no transfer records yet." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Transfers" subtitle="Your transfer history" />
      <SectionCard>
        <DataTable columns={columns} data={data} getRowId={(r) => r.transferRequestId} />
      </SectionCard>
    </div>
  );
}
