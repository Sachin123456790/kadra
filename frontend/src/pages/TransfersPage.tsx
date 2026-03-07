import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, DEFAULT_FUND_CODE } from '@/config/constants';
import { getFailedTransfers, getSuccessfulTransfers } from '@/services';
import type { FailedTransfer, SuccessfulTransfer } from '@/services/tokenization.service';
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const successCols: Column<SuccessfulTransfer>[] = [
  { key: "fromWalletAddress", header: "From", className: "font-mono text-xs" },
  { key: "toWalletAddress", header: "To", className: "font-mono text-xs" },
  { key: "tokenAmount", header: "Amount", render: (r) => fmt(parseFloat(r.tokenAmount)) },
  { key: "transferRequestId", header: "Status", render: () => <StatusBadge status="Success" /> },
  { key: "txHash", header: "Tx Hash", className: "font-mono text-xs", render: (r) => r.txHash || "—" },
  { key: "timestamp", header: "Date", render: (r) => new Date(r.timestamp).toLocaleDateString() },
];

const failedCols: Column<FailedTransfer>[] = [
  { key: "fromWalletAddress", header: "From", className: "font-mono text-xs" },
  { key: "toWalletAddress", header: "To", className: "font-mono text-xs" },
  { key: "tokenAmount", header: "Amount", render: (r) => fmt(parseFloat(r.tokenAmount)) },
  { key: "transferRequestId", header: "Status", render: () => <StatusBadge status="Failed" /> },
  { key: "failureCode", header: "Failure Reason", render: (r) => r.failureCode ? r.failureCode.replace(/_/g, ' ') : "—" },
  { key: "timestamp", header: "Date", render: (r) => new Date(r.timestamp).toLocaleDateString() },
];

export default function TransfersPage() {
  const fundId = DEFAULT_FUND_CODE;

  const {
    data: failedData,
    isLoading: failedLoading,
    error: failedError,
  } = useQuery({
    queryKey: QUERY_KEYS.failedTransfers(fundId),
    queryFn: () => getFailedTransfers(fundId).then(r => r.data),
  });

  const {
    data: successData,
    isLoading: successLoading,
    error: successError,
  } = useQuery({
    queryKey: QUERY_KEYS.successfulTransfers(fundId),
    queryFn: () => getSuccessfulTransfers(fundId).then(r => r.data),
  });

  if (failedLoading || successLoading) return <div className="p-6">Loading...</div>;
  if (failedError) return <ErrorAlert title="Failed Transfers Error" message={(failedError as Error).message} />;
  if (successError) return <ErrorAlert title="Successful Transfers Error" message={(successError as Error).message} />;

  const failed = failedData ?? [];
  const successful = successData ?? [];

  return (
    <div>
      <PageHeader title="Transfers" subtitle="Monitor token transfer activity" />
      <div className="space-y-6">
        <SectionCard title={`Failed Transfers (${failed.length})`}>
          {failed.length === 0 ? (
            <EmptyState title="No failed transfers" message="All transfer attempts have succeeded." />
          ) : (
            <DataTable columns={failedCols} data={failed} getRowId={(r) => r.transferRequestId} />
          )}
        </SectionCard>
        <SectionCard title={`Successful Transfers (${successful.length})`}>
          {successful.length === 0 ? (
            <EmptyState title="No successful transfers" message="No transfers have been completed yet." />
          ) : (
            <DataTable columns={successCols} data={successful} getRowId={(r) => r.transferRequestId} />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
