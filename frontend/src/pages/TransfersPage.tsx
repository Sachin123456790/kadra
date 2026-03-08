import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, DEFAULT_FUND_CODE } from '@/config/constants';
import { getFailedTransfers, getSuccessfulTransfers, getOwnershipHistory } from '@/services';
import type { FailedTransfer, SuccessfulTransfer } from '@/services/tokenization.service';
import type { OwnershipEvent } from '@/services/ownership.service';
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

const ownershipCols: Column<OwnershipEvent>[] = [
  { key: "eventType", header: "Event Type", render: (r) => (
    <StatusBadge status={r.eventType} />
  )},
  { key: "toWalletAddress", header: "Wallet Address", className: "font-mono text-xs", render: (r) => r.toWalletAddress },
  { key: "tokenDelta", header: "Amount", render: (r) => fmt(parseFloat(r.tokenDelta)) },
  { key: "txHash", header: "Tx Hash", className: "font-mono text-xs", render: (r) => r.txHash ? `${r.txHash.slice(0, 10)}...` : "---" },
  { key: "blockNumber", header: "Block Number", render: (r) => r.blockNumber ?? "---" },
  { key: "eventTimestamp", header: "Timestamp", render: (r) => new Date(r.eventTimestamp).toLocaleString() },
];

type Tab = 'transfers' | 'ownership';

export default function TransfersPage() {
  const fundId = DEFAULT_FUND_CODE;
  const [activeTab, setActiveTab] = useState<Tab>('transfers');

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

  const {
    data: ownershipData,
    isLoading: ownershipLoading,
    error: ownershipError,
  } = useQuery({
    queryKey: QUERY_KEYS.ownershipHistory(fundId),
    queryFn: () => getOwnershipHistory(fundId).then(r => r.data),
    enabled: activeTab === 'ownership',
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'transfers', label: 'Transfers' },
    { key: 'ownership', label: 'Ownership History' },
  ];

  const renderTransfersTab = () => {
    if (failedLoading || successLoading) return <div className="p-6 text-gray-600">Loading...</div>;
    if (failedError) return <ErrorAlert title="Failed Transfers Error" message={(failedError as Error).message} />;
    if (successError) return <ErrorAlert title="Successful Transfers Error" message={(successError as Error).message} />;

    const failed = failedData ?? [];
    const successful = successData ?? [];

    return (
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
    );
  };

  const renderOwnershipTab = () => {
    if (ownershipLoading) return <div className="p-6 text-gray-600">Loading ownership history...</div>;
    if (ownershipError) return <ErrorAlert title="Ownership History Error" message={(ownershipError as Error).message} />;

    const events = ownershipData ?? [];

    return (
      <SectionCard title={`Ownership Events (${events.length})`}>
        {events.length === 0 ? (
          <EmptyState title="No ownership events" message="No token minting or transfer events recorded yet." />
        ) : (
          <DataTable columns={ownershipCols} data={events} getRowId={(r) => r.eventId} />
        )}
      </SectionCard>
    );
  };

  return (
    <div>
      <PageHeader title="Transfers" subtitle="Monitor token transfer activity and ownership history" />
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      {activeTab === 'transfers' ? renderTransfersTab() : renderOwnershipTab()}
    </div>
  );
}
