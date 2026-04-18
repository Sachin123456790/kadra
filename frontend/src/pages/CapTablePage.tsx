import { useMemo, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download, ChevronRight, ChevronDown } from 'lucide-react';
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
import { SkeletonCard, TableSkeleton } from "@/components/kadra/Skeleton";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import { HashDisplay } from "@/components/kadra/HashDisplay";
import { CopyButton } from "@/components/kadra/CopyButton";
import { DerivedAmount } from "@/components/kadra/DerivedAmount";
import { formatCompact } from "@/lib/format";

const OWNERSHIP_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#2563eb', '#c026d3'] as const;

const fmtCurrency = (n: number) =>
  n === 0
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

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
  totalSettledTokens,
}: {
  readonly row: EnrichedCapTableRow;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  readonly totalSettledTokens: number;
}) {
  const settledTokens = parseFloat(row.settledTokenBalance);
  return (
    <>
      <tr
        className="border-b border-border cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-4 py-3 font-medium text-foreground">{row.investorName ?? "—"}</td>
        <td
          className="px-4 py-3 text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <DerivedAmount
            amount={
              <span className="inline-flex items-center">
                <span className="inline-block h-2 w-2 rounded-full bg-primary mr-1.5" />
                {row.ownershipPct.toFixed(2)}%
              </span>
            }
            label={`Ownership — ${row.investorName ?? "Investor"}`}
            formula="investor token balance ÷ total settled token supply × 100"
            steps={[
              {
                label: "Investor settled units",
                value: settledTokens.toLocaleString("en-US"),
                sourceRef: {
                  kind: "wallet",
                  id: row.walletAddress,
                  label: `${row.walletAddress.slice(0, 6)}…${row.walletAddress.slice(-4)}`,
                },
              },
              {
                label: "Total settled supply (fund)",
                value: totalSettledTokens.toLocaleString("en-US"),
                formula: "÷",
              },
              {
                label: "Ratio × 100",
                value: `${row.ownershipPct.toFixed(4)}%`,
                formula: "= ownership",
              },
            ]}
            result={`${row.ownershipPct.toFixed(2)}%`}
          />
        </td>
        <td
          className="px-4 py-3 text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          {row.capitalContributed > 0 ? (
            <DerivedAmount
              amount={fmtCurrency(row.capitalContributed)}
              label="Capital Contributed"
              formula="Subscription committed amount (signed LPA)"
              steps={[
                {
                  label: "Committed via subscription",
                  value: fmtCurrency(row.capitalContributed),
                  sourceRef: {
                    kind: "subscription",
                    id: row.investorId,
                    route: "/subscriptions",
                    label: "View subscription",
                  },
                },
                {
                  label: "Settlement status",
                  value: row.settledAt ? "Settled" : "Pending",
                  formula: row.settledAt ? `on ${fmtDate(row.settledAt)}` : undefined,
                },
              ]}
              result={fmtCurrency(row.capitalContributed)}
              asOf={row.settledAt ?? undefined}
              sourceDocumentRef={
                row.governingHashHex
                  ? { id: row.governingHashHex, name: "Governing LPA" }
                  : undefined
              }
            />
          ) : (
            fmtCurrency(row.capitalContributed)
          )}
        </td>
        <td className="px-4 py-3 text-muted-foreground">{fmtDate(row.settledAt)}</td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-border bg-muted">
          <td colSpan={5} className="px-8 py-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <span className="text-muted-foreground font-medium">Account Address</span>
                <div className="mt-0.5 inline-flex items-center gap-1">
                  <ExplorerLink value={row.walletAddress} type="address" />
                  <CopyButton value={row.walletAddress} />
                </div>
              </div>
              <div>
                <span className="text-muted-foreground font-medium">Settled Units</span>
                <div className="mt-0.5 font-mono text-foreground">
                  {parseFloat(row.settledTokenBalance).toLocaleString("en-US")}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground font-medium">Settlement Reference</span>
                <div className="mt-0.5">
                  {row.settlementTxHash ? (
                    <span className="inline-flex items-center gap-1">
                      <ExplorerLink value={row.settlementTxHash} type="tx" />
                      <CopyButton value={row.settlementTxHash} />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground font-medium">Governing LPA Hash</span>
                <div className="mt-0.5">
                  <HashDisplay value={row.governingHashHex} />
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
            formatter={(value: string) => <span className="text-base text-muted-foreground">{value}</span>}
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
        <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold text-foreground">
          <td className="px-4 py-3 w-10" />
          <td className="px-4 py-3 font-semibold">Total</td>
          <td className="px-4 py-3 font-semibold">{totalOwnership.toFixed(2)}%</td>
          <td className="px-4 py-3 font-semibold">{fmtCurrency(totalCapital)}</td>
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
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none"
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

  if (isLoading) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
  if (error) return <ErrorAlert title="Unable to load cap table" message={`${(error as Error).message}. Try refreshing the page.`} />;
  if (!data || data.rows.length === 0) return (
    <div>
      <PageHeader
        title="Cap Table"
        subtitle="Current ownership and allocation breakdown"
        action={<ExportCapTableButton fundId={fundId} />}
      />
      <EmptyState title="No ownership records yet" message="Settle investor subscriptions to populate the cap table." />
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
        subtitle={`Last updated: ${lastUpdated}`}
        action={<ExportCapTableButton fundId={fundId} />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Investors" value={data.rows.length} />
        <MetricCard label="Total Ownership" value={`${totalOwnership.toFixed(1)}%`} />
        <MetricCard
          label="Units Settled"
          value={formatCompact(totalSettled)}
        />
        <MetricCard label="Pending Allocations" value={pendingCount} />
      </div>

      <OwnershipPieChart rows={data.rows} />

      <SectionCard className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 w-10" />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Investor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Ownership %</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Capital Contributed</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Settlement Date</th>
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
                    totalSettledTokens={totalSettled}
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
