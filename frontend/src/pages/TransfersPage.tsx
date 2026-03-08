import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  AreaChart, Area,
} from 'recharts';
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
import { ExplorerLink } from "@/components/kadra/ExplorerLink";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const successCols: Column<SuccessfulTransfer>[] = [
  { key: "fromWalletAddress", header: "From", render: (r) => <ExplorerLink value={r.fromWalletAddress} type="address" /> },
  { key: "toWalletAddress", header: "To", render: (r) => <ExplorerLink value={r.toWalletAddress} type="address" /> },
  { key: "tokenAmount", header: "Amount", render: (r) => fmt(parseFloat(r.tokenAmount)) },
  { key: "transferRequestId", header: "Status", render: () => <StatusBadge status="Success" /> },
  { key: "txHash", header: "Tx Hash", render: (r) => <ExplorerLink value={r.txHash || "—"} type="tx" /> },
  { key: "timestamp", header: "Date", render: (r) => new Date(r.timestamp).toLocaleDateString() },
];

const failedCols: Column<FailedTransfer>[] = [
  { key: "fromWalletAddress", header: "From", render: (r) => <ExplorerLink value={r.fromWalletAddress} type="address" /> },
  { key: "toWalletAddress", header: "To", render: (r) => <ExplorerLink value={r.toWalletAddress} type="address" /> },
  { key: "tokenAmount", header: "Amount", render: (r) => fmt(parseFloat(r.tokenAmount)) },
  { key: "transferRequestId", header: "Status", render: () => <StatusBadge status="Failed" /> },
  { key: "failureCode", header: "Failure Reason", render: (r) => r.failureCode ? r.failureCode.replace(/_/g, ' ') : "—" },
  { key: "timestamp", header: "Date", render: (r) => new Date(r.timestamp).toLocaleDateString() },
];

const ownershipCols: Column<OwnershipEvent>[] = [
  { key: "eventType", header: "Event Type", render: (r) => (
    <StatusBadge status={r.eventType} />
  )},
  { key: "toWalletAddress", header: "Wallet Address", render: (r) => <ExplorerLink value={r.toWalletAddress} type="address" /> },
  { key: "tokenDelta", header: "Amount", render: (r) => fmt(parseFloat(r.tokenDelta)) },
  { key: "txHash", header: "Tx Hash", render: (r) => <ExplorerLink value={r.txHash || "—"} type="tx" /> },
  { key: "blockNumber", header: "Block Number", render: (r) => r.blockNumber ?? "---" },
  { key: "eventTimestamp", header: "Timestamp", render: (r) => new Date(r.eventTimestamp).toLocaleString() },
];

function TransferSummaryChart({
  successCount,
  failedCount,
}: {
  successCount: number;
  failedCount: number;
}) {
  const data = [
    { name: 'Successful', count: successCount },
    { name: 'Failed', count: failedCount },
  ];
  const colors = ['#16a34a', '#ef4444'];

  return (
    <SectionCard title="Transfer Summary" className="mb-6">
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
          <Tooltip contentStyle={{ borderRadius: 6, borderColor: '#e5e7eb', fontSize: 13 }} />
          <Bar dataKey="count" name="Transfers" radius={[4, 4, 0, 0]}>
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

function OwnershipTimelineChart({ events }: { events: OwnershipEvent[] }) {
  const chartData = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => new Date(a.eventTimestamp).getTime() - new Date(b.eventTimestamp).getTime(),
    );
    let cumulative = 0;
    return sorted.map((e) => {
      cumulative += parseFloat(e.tokenDelta);
      return {
        date: new Date(e.eventTimestamp).toLocaleDateString(),
        cumulativeTokens: cumulative,
        eventType: e.eventType,
      };
    });
  }, [events]);

  if (chartData.length === 0) return null;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Token Movement Timeline</h4>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData} margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <Tooltip
            formatter={(value: number) => fmt(value)}
            contentStyle={{ borderRadius: 6, borderColor: '#e5e7eb', fontSize: 13 }}
          />
          <Area
            type="monotone"
            dataKey="cumulativeTokens"
            name="Cumulative Tokens"
            stroke="#4f46e5"
            fill="#c7d2fe"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

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
        <TransferSummaryChart successCount={successful.length} failedCount={failed.length} />
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
      <div className="space-y-6">
        {events.length > 0 && <OwnershipTimelineChart events={events} />}
        <SectionCard title={`Ownership Events (${events.length})`}>
          {events.length === 0 ? (
            <EmptyState title="No ownership events" message="No token minting or transfer events recorded yet." />
          ) : (
            <DataTable columns={ownershipCols} data={events} getRowId={(r) => r.eventId} />
          )}
        </SectionCard>
      </div>
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
