import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download, Copy, Check } from 'lucide-react';
import { QUERY_KEYS, DEFAULT_FUND_CODE } from '@/config/constants';
import { getCapTable, getCapitalAccounts } from '@/services/ownership.service';
import { getSubscriptions } from '@/services/subscriptions.service';
import { createAuditExport } from '@/services/audit.service';
import type { CapTableRow } from '@/services/ownership.service';
import type { Subscription } from '@/services/subscriptions.service';
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import { useState } from 'react';

const OWNERSHIP_COLORS = ['#4338ca', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'] as const;

const fmtCurrency = (n: number) =>
  n === 0
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

/* ── Copy Button ── */

function CopyButton({ text }: { readonly text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="ml-1 inline-flex text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy to clipboard"
      type="button"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ── Truncated Hash with Copy ── */

function TruncatedHash({ hash }: { readonly hash: string | null | undefined }) {
  if (!hash || hash === "—") return <span className="text-gray-500">—</span>;
  const truncated = hash.length > 12 ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : hash;
  return (
    <span className="inline-flex items-center">
      <span className="font-mono text-xs text-gray-600">{truncated}</span>
      <CopyButton text={hash} />
    </span>
  );
}

/* ── Merged row type ── */

interface EnrichedCapTableRow extends CapTableRow {
  capitalContributed: number;
  settledAt: string | null;
  settlementTxHash: string | null;
  governingHashHex: string | null;
}

function enrichRows(
  rows: ReadonlyArray<CapTableRow>,
  subscriptions: ReadonlyArray<Subscription>,
): EnrichedCapTableRow[] {
  const subByInvestor = new Map<string, Subscription>();
  for (const sub of subscriptions) {
    if (sub.investorId) {
      subByInvestor.set(sub.investorId, sub);
    }
  }

  return rows.map((row) => {
    const sub = subByInvestor.get(row.investorId);
    return {
      ...row,
      capitalContributed: sub ? parseFloat(sub.committedAmount) : 0,
      settledAt: sub?.settledAt ?? null,
      settlementTxHash: null, // not available in subscription data
      governingHashHex: sub?.governingHashHex ?? null,
    };
  });
}

/* ── Columns ── */

const columns: Column<EnrichedCapTableRow>[] = [
  {
    key: "investorName",
    header: "Investor",
    render: (r) => <span className="font-medium text-gray-900">{r.investorName ?? "—"}</span>,
  },
  {
    key: "walletAddress",
    header: "Wallet",
    render: (r) => (
      <span className="inline-flex items-center">
        <ExplorerLink value={r.walletAddress} type="address" />
        <CopyButton text={r.walletAddress} />
      </span>
    ),
  },
  {
    key: "ownershipPct",
    header: "Ownership %",
    render: (r) => <span className="text-gray-900">{r.ownershipPct.toFixed(2)}%</span>,
  },
  {
    key: "settledTokenBalance",
    header: "Token Balance",
    render: (r) => (
      <span className="font-mono text-gray-900">
        {parseFloat(r.settledTokenBalance).toLocaleString("en-US")}
      </span>
    ),
  },
  {
    key: "capitalContributed",
    header: "Capital Contributed",
    render: (r) => <span className="text-gray-900">{fmtCurrency(r.capitalContributed)}</span>,
  },
  {
    key: "settledAt",
    header: "Settlement Date",
    render: (r) => <span className="text-gray-600">{fmtDate(r.settledAt)}</span>,
  },
  {
    key: "governingHashHex",
    header: "Governing LPA Hash",
    render: (r) => <TruncatedHash hash={r.governingHashHex} />,
  },
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

/* ── Total Row ── */

function TotalRow({ rows }: { readonly rows: ReadonlyArray<EnrichedCapTableRow> }) {
  const totalOwnership = rows.reduce((s, r) => s + r.ownershipPct, 0);
  const totalTokens = rows.reduce((s, r) => s + parseFloat(r.settledTokenBalance), 0);
  const totalCapital = rows.reduce((s, r) => s + r.capitalContributed, 0);

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
      <div className="flex text-sm font-semibold text-gray-900">
        <span className="flex-1">Total</span>
        <span className="w-28 text-right">{totalOwnership.toFixed(2)}%</span>
        <span className="w-32 text-right font-mono">{totalTokens.toLocaleString("en-US")}</span>
        <span className="w-36 text-right">{fmtCurrency(totalCapital)}</span>
      </div>
    </div>
  );
}

/* ── Export Button ── */

function ExportCapTableButton({ fundId }: { readonly fundId: string }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await createAuditExport(fundId);
    } finally {
      setExporting(false);
    }
  }, [fundId]);

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
      type="button"
    >
      <Download className="h-4 w-4" />
      {exporting ? "Exporting..." : "Export Cap Table"}
    </button>
  );
}

/* ── Page ── */

export default function CapTablePage() {
  const fundId = DEFAULT_FUND_CODE;

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.capTable(fundId),
    queryFn: () => getCapTable(fundId).then(r => r.data),
  });

  const { data: subscriptions } = useQuery({
    queryKey: QUERY_KEYS.subscriptions(fundId),
    queryFn: () => getSubscriptions(fundId).then(r => r.data),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Cap Table Error" message={(error as Error).message} />;
  if (!data || data.rows.length === 0) return (
    <div>
      <PageHeader
        title="Cap Table"
        subtitle="Current ownership and allocation breakdown"
        action={<ExportCapTableButton fundId={fundId} />}
      />
      <EmptyState title="No cap table data" message="No ownership positions have been recorded yet." />
    </div>
  );

  const enrichedRows = enrichRows(data.rows, subscriptions ?? []);
  const totalOwnership = data.rows.reduce((s, e) => s + e.ownershipPct, 0);
  const totalSettled = data.rows.reduce((s, e) => s + parseFloat(e.settledTokenBalance), 0);
  const pendingCount = data.rows.filter(e => e.pendingAllocationPct > 0).length;

  const lastUpdated = data.asOfTimestamp
    ? new Date(data.asOfTimestamp).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <div>
      <PageHeader
        title="Cap Table"
        subtitle={`Last updated from chain: ${lastUpdated}`}
        action={<ExportCapTableButton fundId={fundId} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Investors" value={data.rows.length} />
        <MetricCard label="Total Ownership" value={`${totalOwnership.toFixed(1)}%`} />
        <MetricCard
          label="Settled Balance"
          value={new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalSettled)}
        />
        <MetricCard label="Pending Allocations" value={pendingCount} />
      </div>

      <OwnershipPieChart rows={data.rows} />

      <SectionCard className="mt-6">
        <DataTable
          columns={columns}
          data={enrichedRows}
          getRowId={(r) => r.investorId ?? r.walletAddress}
        />
        <TotalRow rows={enrichedRows} />
      </SectionCard>
    </div>
  );
}
