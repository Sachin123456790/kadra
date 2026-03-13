import { useMemo, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download, Copy, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { QUERY_KEYS, DEFAULT_FUND_CODE } from '@/config/constants';
import { getCapTable, getCapitalAccounts } from '@/services/ownership.service';
import { getSubscriptions } from '@/services/subscriptions.service';
import { createAuditExport } from '@/services/audit.service';
import type { CapTableRow } from '@/services/ownership.service';
import type { Subscription } from '@/services/subscriptions.service';
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import { formatCompact } from "@/lib/format";

const OWNERSHIP_COLORS = ['#1a1a1a', '#404040', '#666666', '#8c8c8c', '#b3b3b3', '#d9d9d9'] as const;

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

/* ── Expandable Cap Table Row ── */

function CapTableRowItem({
  row,
  isExpanded,
  onToggle,
}: {
  readonly row: EnrichedCapTableRow;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-gray-500">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-4 py-3 font-medium text-gray-900">{row.investorName ?? "—"}</td>
        <td className="px-4 py-3 text-gray-900">{row.ownershipPct.toFixed(2)}%</td>
        <td className="px-4 py-3 text-gray-900">{fmtCurrency(row.capitalContributed)}</td>
        <td className="px-4 py-3 text-gray-600">{fmtDate(row.settledAt)}</td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td colSpan={5} className="px-8 py-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <span className="text-gray-500 font-medium">Wallet</span>
                <div className="mt-0.5 inline-flex items-center gap-1">
                  <ExplorerLink value={row.walletAddress} type="address" />
                  <CopyButton text={row.walletAddress} />
                </div>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Token Balance</span>
                <div className="mt-0.5 font-mono text-gray-900">
                  {parseFloat(row.settledTokenBalance).toLocaleString("en-US")}
                </div>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Settlement Tx</span>
                <div className="mt-0.5">
                  {row.settlementTxHash ? (
                    <span className="inline-flex items-center gap-1">
                      <ExplorerLink value={row.settlementTxHash} type="tx" />
                      <CopyButton text={row.settlementTxHash} />
                    </span>
                  ) : (
                    <span className="text-gray-500">--</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Governing LPA Hash</span>
                <div className="mt-0.5">
                  <TruncatedHash hash={row.governingHashHex} />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

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
            formatter={(value: string) => <span className="text-base text-gray-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

/* ── Total Row ── */

function TotalRow({ rows }: { readonly rows: ReadonlyArray<EnrichedCapTableRow> }) {
  const totalOwnership = rows.reduce((s, r) => s + r.ownershipPct, 0);
  const totalCapital = rows.reduce((s, r) => s + r.capitalContributed, 0);

  return (
    <table className="w-full text-sm">
      <tfoot>
        <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-gray-900">
          <td className="px-4 py-3 w-10" />
          <td className="px-4 py-3">Total</td>
          <td className="px-4 py-3">{totalOwnership.toFixed(2)}%</td>
          <td className="px-4 py-3">{fmtCurrency(totalCapital)}</td>
          <td className="px-4 py-3" />
        </tr>
      </tfoot>
    </table>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.capTable(fundId),
    queryFn: () => getCapTable(fundId).then(r => r.data),
    refetchInterval: 30000,
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
          value={formatCompact(totalSettled)}
        />
        <MetricCard label="Pending Allocations" value={pendingCount} />
      </div>

      <OwnershipPieChart rows={data.rows} />

      <SectionCard className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 w-10" />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Investor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ownership %</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Capital Contributed</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Settlement Date</th>
              </tr>
            </thead>
            <tbody>
              {enrichedRows.map((row) => {
                const rowId = row.investorId ?? row.walletAddress;
                return (
                  <CapTableRowItem
                    key={rowId}
                    row={row}
                    isExpanded={expandedId === rowId}
                    onToggle={() => setExpandedId(expandedId === rowId ? null : rowId)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
        <TotalRow rows={enrichedRows} />
      </SectionCard>
    </div>
  );
}
