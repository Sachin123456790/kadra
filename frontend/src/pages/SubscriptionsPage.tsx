import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { PageHeader } from "@/components/angainor/PageHeader";
import { SectionCard } from "@/components/angainor/SectionCard";
import { StatusBadge } from "@/components/angainor/StatusBadge";
import { ErrorAlert } from "@/components/angainor/ErrorAlert";
import { EmptyState } from "@/components/angainor/EmptyState";
import { TableSkeleton } from "@/components/angainor/Skeleton";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getSubscriptions, getInvestors, getDocuments, createSubscriptions } from "@/services";
import { getFundAllocation } from "@/services/subscriptions.service";
import { createNotice } from "@/services/notices.service";
import { toFriendlyMessage } from "@/lib/errorMessages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Wallet,
  FileText,
  Calendar,
  Clock,
  Download,
  Search,
  AlertTriangle,
  MoreHorizontal,
  Bell,
  BarChart3,
} from "lucide-react";
import { HashDisplay } from "@/components/angainor/HashDisplay";
import { cn } from "@/lib/utils";
import { useHighlightRow } from "@/hooks/useHighlightRow";
import type { Subscription } from "@/services/subscriptions.service";
import type { Investor } from "@/services/investors.service";

// ── Helpers ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  SETTLED: "#4f46e5",
  PENDING: "#fbbf24",
  MISMATCH: "#f59e0b",
};

const fmt = (n: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function buildSubscriptionRef(investorId: string): string {
  const investorPrefix = investorId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const suffix = Date.now().toString(36).toUpperCase();
  return `SUB-${investorPrefix}-${suffix}`;
}

function statusBadge(status: string) {
  if (status === "MISMATCH") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-yellow-50 text-yellow-700">
        Mismatch
      </span>
    );
  }
  return <StatusBadge status={status} />;
}

function triggerCsvDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type StatusFilter = "ALL" | "PENDING" | "SETTLED";

// ── Main component ──────────────────────────────────────────

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const { highlightId, isPulsing } = useHighlightRow();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [investorFilter, setInvestorFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAnalytics, setShowAnalytics] = useState(true);
  const fundId = DEFAULT_FUND_CODE;

  // ── Create subscription form state
  const [createLpId, setCreateLpId] = useState("");
  const [createAmount, setCreateAmount] = useState("");
  const [createAllocation, setCreateAllocation] = useState("");

  const { data: subscriptions, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.subscriptions(fundId),
    queryFn: () => getSubscriptions(fundId).then(r => r.data),
  });

  const { data: investorsData } = useQuery({
    queryKey: QUERY_KEYS.investors(fundId),
    queryFn: () => getInvestors(fundId).then(r => r.data),
  });

  const { data: documentsData } = useQuery({
    queryKey: QUERY_KEYS.documents(fundId),
    queryFn: () => getDocuments(fundId).then(r => r.data),
  });

  // Fund allocation: total committed pct, headroom, per-investor breakdown.
  // Powers the "Top Up" detection in the create modal so the admin sees
  // real-time validation BEFORE submitting.
  const { data: allocationData } = useQuery({
    queryKey: ["fund-allocation", fundId],
    queryFn: () => getFundAllocation(fundId).then(r => r.data),
  });

  // Resolve the selected investor's existing allocation (if any) so the modal
  // can frame the form as a top-up vs. a brand-new subscription.
  const selectedInvestorAllocation = useMemo(() => {
    if (!createLpId || !allocationData) return null;
    return allocationData.investors.find(i => i.investorId === createLpId) ?? null;
  }, [createLpId, allocationData]);

  const proposedAllocationPct = Number(createAllocation) || 0;
  const headroomPct = allocationData?.remainingHeadroomPct ?? 100;
  const investorExistingPct = selectedInvestorAllocation?.totalAllocationPct ?? 0;
  const investorAfterPct = investorExistingPct + proposedAllocationPct;
  const fundAfterPct = (allocationData?.totalAllocationPct ?? 0) + proposedAllocationPct;
  const exceedsFundCap = fundAfterPct > 100 + 0.000001;
  const exceedsInvestorCap = investorAfterPct > 100 + 0.000001;
  const allocationBlocked = exceedsFundCap || exceedsInvestorCap;

  const latestLpa = useMemo(() => {
    if (!documentsData) return null;
    const lpaDocs = documentsData.filter(d => d.documentType === "MASTER_LPA");
    if (lpaDocs.length === 0) return null;
    return lpaDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [documentsData]);

  const latestLpaHash = latestLpa?.hash?.hashHex ?? "";

  const remindMutation = useMutation({
    mutationFn: (sub: Subscription) =>
      createNotice({
        fundId,
        type: "GENERAL",
        recipientInvestorId: sub.investorId,
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success("Reminder notice generated");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notices(fundId) });
    },
    onError: (err: unknown) => {
      toast.error(toFriendlyMessage(err));
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!latestLpa) return Promise.reject(new Error("No LPA document found"));
      const selectedInvestor = investorsData?.find(inv => inv.investorId === createLpId);
      const walletId = selectedInvestor?.wallets?.[0]?.walletId ?? "";
      return createSubscriptions(fundId, latestLpa.documentId, [
        {
          investorId: createLpId,
          walletId,
          allocationPct: Number(createAllocation),
          committedAmount: createAmount,
          subscriptionRef: buildSubscriptionRef(createLpId),
        },
      ]).then(r => r.data);
    },
    onSuccess: () => {
      toast.success(
        selectedInvestorAllocation
          ? "Top-up subscription created"
          : "Subscription created successfully",
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscriptions(fundId) });
      // Refresh fund headroom + per-investor allocation breakdown.
      queryClient.invalidateQueries({ queryKey: ["fund-allocation", fundId] });
      setShowCreateModal(false);
    },
    onError: (err: Error) => {
      toast.error("Failed to create subscription: " + err.message);
    },
  });

  // ── Derived data
  const totalCommitted = useMemo(() => {
    if (!subscriptions) return 0;
    return subscriptions.reduce((sum, sub) => sum + (Number(sub.committedAmount) || 0), 0);
  }, [subscriptions]);

  const settledCount = useMemo(() => {
    if (!subscriptions) return 0;
    return subscriptions.filter(s => s.status.toUpperCase() === "SETTLED").length;
  }, [subscriptions]);

  const settlementPct = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) return 0;
    return Math.round((settledCount / subscriptions.length) * 100);
  }, [subscriptions, settledCount]);

  const statusChartData = useMemo(() => {
    if (!subscriptions) return [];
    const counts: Record<string, number> = {};
    for (const sub of subscriptions) {
      const key = sub.status.toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [subscriptions]);

  // Cumulative committed capital over time for line chart
  const commitmentTimeline = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) return [];
    // Use createdAt, fallback to settledAt, fallback to index-based ordering
    const withDates = subscriptions.map((s, i) => ({
      ...s,
      sortDate: s.createdAt ?? s.settledAt ?? null,
      index: i,
    }));
    const hasDates = withDates.some(s => s.sortDate);
    const sorted = hasDates
      ? [...withDates].filter(s => s.sortDate).sort((a, b) => new Date(a.sortDate!).getTime() - new Date(b.sortDate!).getTime())
      : withDates; // no dates available — use insertion order
    let cumulative = 0;
    const points: { date: string; committed: number }[] = [];
    for (const sub of sorted) {
      cumulative += Number(sub.committedAmount) || 0;
      const date = sub.sortDate
        ? new Date(sub.sortDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : `#${sub.index + 1}`;
      // Merge same-date entries (keep latest cumulative)
      const existing = points.find(p => p.date === date);
      if (existing) {
        existing.committed = cumulative;
      } else {
        points.push({ date, committed: cumulative });
      }
    }
    return points;
  }, [subscriptions]);

  // ── Unique investors for filter dropdown
  const uniqueInvestors = useMemo(() => {
    if (!subscriptions) return [];
    const seen = new Map<string, string>();
    for (const sub of subscriptions) {
      if (!seen.has(sub.investorId)) {
        seen.set(sub.investorId, sub.investorName || sub.investorId);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [subscriptions]);

  // ── Filtered subscriptions
  const filteredSubscriptions = useMemo(() => {
    if (!subscriptions) return [];
    return subscriptions.filter(sub => {
      if (statusFilter !== "ALL" && sub.status.toUpperCase() !== statusFilter) return false;
      if (investorFilter && sub.investorId !== investorFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (sub.investorName || "").toLowerCase();
        const ref = (sub.subscriptionRef || "").toLowerCase();
        if (!name.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    });
  }, [subscriptions, statusFilter, investorFilter, searchQuery]);

  function handleExportCsv(): void {
    const headers = ["Investor", "Allocation %", "Committed", "Status", "Created", "Settled"];
    const rows = filteredSubscriptions.map(sub => [
      sub.investorName || sub.investorId,
      String(sub.allocationPct),
      String(Number(sub.committedAmount) || 0),
      sub.status,
      sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : "",
      sub.settledAt ? new Date(sub.settledAt).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    triggerCsvDownload("subscriptions.csv", csv);
    toast.success("CSV exported successfully");
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <TableSkeleton rows={5} columns={7} />
      </div>
    );
  }

  if (error) {
    return <ErrorAlert title="Unable to load subscriptions" message={`${(error as Error).message}. Try refreshing the page.`} />;
  }

  if (!subscriptions || subscriptions.length === 0) {
    return <EmptyState title="No subscriptions" message="No subscription records exist yet." />;
  }

  const pendingCount = subscriptions.filter(s => s.status.toUpperCase() === "PENDING").length;

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        subtitle="Manage investor subscriptions, allocations, and settlement progress"
        action={
          <Button
            onClick={() => {
              setCreateLpId("");
              setCreateAmount("");
              setCreateAllocation("");
              setShowCreateModal(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Subscription
          </Button>
        }
      />

      {/* ── Summary strip ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-5 py-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-sm text-muted-foreground">Pending: <span className="font-semibold text-foreground">{pendingCount}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">Settled: <span className="font-semibold text-foreground">{settledCount}</span></span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="text-sm text-muted-foreground">Committed: <span className="font-semibold text-foreground">{fmt(totalCommitted)}</span></span>
        <div className="h-4 w-px bg-border" />
        <span className="text-sm text-muted-foreground">{settlementPct}% Settled</span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{subscriptions.length} subscriptions</span>
        <button
          onClick={() => setShowAnalytics(prev => !prev)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {showAnalytics ? "Hide Analytics" : "Analytics"}
        </button>
      </div>

      {/* ── Collapsible analytics panel ────────────────────────── */}
      {showAnalytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 animate-fade-in">
          {/* Status Breakdown — donut */}
          <SectionCard>
            <h3 className="text-sm font-medium text-muted-foreground mb-2 text-center">Status Breakdown</h3>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={55}
                >
                  {statusChartData.map(entry => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#fbbf24" }} />
                <span className="text-xs text-muted-foreground">Pending: {pendingCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#4f46e5" }} />
                <span className="text-xs text-muted-foreground">Settled: {settledCount}</span>
              </div>
            </div>
          </SectionCard>

          {/* Cumulative Committed Capital — line chart */}
          <SectionCard className="lg:col-span-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Cumulative Committed Capital</h3>
            {commitmentTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={commitmentTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `$${(v / 1_000_000).toFixed(1)}M`}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                    width={55}
                  />
                  <Tooltip
                    formatter={(value: number) => [fmt(value), "Committed"]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="committed"
                    stroke="#4338ca"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#4338ca" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No timeline data available</p>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Filter bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          {(["ALL", "PENDING", "SETTLED"] as StatusFilter[]).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                statusFilter === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-gray-200"
              }`}
            >
              {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <select
          value={investorFilter}
          onChange={e => setInvestorFilter(e.target.value)}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground bg-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">All LPs</option>
          {uniqueInvestors.map(inv => (
            <option key={inv.id} value={inv.id}>{inv.name}</option>
          ))}
        </select>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter data..."
            className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-white text-foreground placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <Button variant="outline" size="sm" onClick={handleExportCsv}>
          <Download className="h-4 w-4 mr-1.5" />
          Export to CSV
        </Button>
      </div>

      {/* ── Subscriptions Table ───────────────────────────────── */}
      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Investor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Allocation %</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Committed</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Settled</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscriptions.map((sub: Subscription) => {
                const isExpanded = expandedId === sub.subscriptionId;
                const investor = investorsData?.find(inv => inv.investorId === sub.investorId);
                const walletAddress = investor?.wallets?.[0]?.address ?? "";

                return (
                  <SubscriptionTableRow
                    key={sub.subscriptionId}
                    sub={sub}
                    isExpanded={isExpanded}
                    walletAddress={walletAddress}
                    onToggle={() => toggleExpand(sub.subscriptionId)}
                    isHighlighted={highlightId === sub.subscriptionId}
                    isPulsing={isPulsing}
                    onRemind={(s) => remindMutation.mutate(s)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Create Subscription Modal ─────────────────────────── */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedInvestorAllocation ? "Top Up Subscription" : "Create Subscription"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedInvestorAllocation
                ? "This investor already holds capital in the fund. The new amount adds to their existing allocation."
                : "Add a new subscription record for an investor."}
            </DialogDescription>
          </DialogHeader>

          {/* Fund headroom strip — always visible so the admin sees what's left. */}
          {allocationData && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-foreground">Fund headroom</span>
                <span className="text-muted-foreground">
                  {(allocationData.totalAllocationPct ?? 0).toFixed(2)}% allocated · {headroomPct.toFixed(2)}% remaining
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full ${exceedsFundCap ? "bg-red-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, (allocationData.totalAllocationPct ?? 0) + (exceedsFundCap ? 0 : proposedAllocationPct))}%` }}
                />
              </div>
              {proposedAllocationPct > 0 && (
                <div className="mt-2 text-muted-foreground">
                  After this subscription:{" "}
                  <span className={exceedsFundCap ? "text-red-600 font-medium" : "text-foreground font-medium"}>
                    {fundAfterPct.toFixed(2)}% of fund
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="lp-select" className="block text-sm font-medium text-muted-foreground mb-1">
                Investor (LP)
              </label>
              <select
                id="lp-select"
                value={createLpId}
                onChange={e => setCreateLpId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Select an investor...</option>
                {(investorsData ?? []).map((inv: Investor) => {
                  const existing = allocationData?.investors.find(a => a.investorId === inv.investorId);
                  const suffix = existing
                    ? ` · ${existing.totalAllocationPct.toFixed(2)}% (${existing.subscriptionCount} sub${existing.subscriptionCount === 1 ? "" : "s"})`
                    : "";
                  return (
                    <option key={inv.investorId} value={inv.investorId}>
                      {inv.legalName}{suffix}
                    </option>
                  );
                })}
              </select>
              {selectedInvestorAllocation && (
                <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1.5 mt-2">
                  Existing allocation:{" "}
                  <span className="font-medium">
                    {selectedInvestorAllocation.totalAllocationPct.toFixed(2)}%
                  </span>{" "}
                  across {selectedInvestorAllocation.subscriptionCount} subscription
                  {selectedInvestorAllocation.subscriptionCount === 1 ? "" : "s"}.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="committed-amount" className="block text-sm font-medium text-muted-foreground mb-1">
                Committed Amount (USD)
              </label>
              <input
                id="committed-amount"
                type="number"
                step="1000"
                min="0"
                value={createAmount}
                onChange={e => setCreateAmount(e.target.value)}
                placeholder="e.g. 2000000"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="allocation-pct" className="block text-sm font-medium text-muted-foreground mb-1">
                Allocation %{" "}
                {selectedInvestorAllocation && (
                  <span className="font-normal text-xs text-muted-foreground">
                    (additional)
                  </span>
                )}
              </label>
              <input
                id="allocation-pct"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={createAllocation}
                onChange={e => setCreateAllocation(e.target.value)}
                placeholder="e.g. 20"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {proposedAllocationPct > 0 && selectedInvestorAllocation && (
                <p className="text-xs text-muted-foreground mt-1">
                  Investor total after top-up:{" "}
                  <span className={exceedsInvestorCap ? "text-red-600 font-medium" : "text-foreground font-medium"}>
                    {investorAfterPct.toFixed(2)}%
                  </span>
                </p>
              )}
              {exceedsFundCap && (
                <p className="text-xs text-red-600 mt-1">
                  Fund total would be {fundAfterPct.toFixed(2)}%. Upload an LPA Amendment to expand the fund first.
                </p>
              )}
              {exceedsInvestorCap && (
                <p className="text-xs text-red-600 mt-1">
                  This investor would hold more than 100% of the fund. Reduce the amount or split the top-up across investors.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                LPA Reference
              </label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                {latestLpaHash ? (
                  <HashDisplay value={latestLpaHash} />
                ) : (
                  <span className="text-sm text-muted-foreground">No LPA document uploaded</span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !createLpId ||
                !createAmount ||
                !createAllocation ||
                !latestLpa ||
                allocationBlocked ||
                createMutation.isPending
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending
                ? "Creating..."
                : selectedInvestorAllocation
                  ? "Top Up Subscription"
                  : "Create Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Expandable subscription row ─────────────────────────────

interface SubscriptionTableRowProps {
  sub: Subscription;
  isExpanded: boolean;
  walletAddress: string;
  onToggle: () => void;
  isHighlighted?: boolean;
  isPulsing?: boolean;
  onRemind?: (sub: Subscription) => void;
}

function SubscriptionTableRow({ sub, isExpanded, walletAddress, onToggle, isHighlighted, isPulsing, onRemind }: SubscriptionTableRowProps) {
  const isPending = sub.status.toUpperCase() === "PENDING";

  return (
    <>
      <tr
        data-highlight-id={sub.subscriptionId}
        onClick={onToggle}
        className={cn(
          "border-b border-border cursor-pointer hover:bg-gray-50 transition-colors",
          isHighlighted && "bg-indigo-50",
          isHighlighted && isPulsing && "animate-pulse",
        )}
      >
        <td className="px-4 py-3 text-muted-foreground">
          {isExpanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-4 py-3 font-medium text-foreground">{sub.investorName || sub.investorId}</td>
        <td className="px-4 py-3 text-foreground">
          <div className="flex items-center gap-2">
            <span>{sub.allocationPct}%</span>
            <div className="w-16 h-1.5 rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${Math.min(sub.allocationPct, 100)}%` }}
              />
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-foreground">{fmt(Number(sub.committedAmount) || 0)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {statusBadge(sub.status)}
            {isPending && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          </div>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : "--"}</td>
        <td className="px-4 py-3 text-muted-foreground">{sub.settledAt ? new Date(sub.settledAt).toLocaleDateString() : "--"}</td>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-gray-100 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onRemind?.(sub)}
                disabled={!onRemind}
              >
                <Bell className="h-4 w-4 mr-2" />
                Remind Investor
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-muted/50">
          <td colSpan={8} className="px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Subscription Reference</p>
                  <p className="text-sm text-foreground">{sub.subscriptionRef}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Record ID</p>
                  <HashDisplay value={sub.subscriptionId} />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Wallet className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Account Address</p>
                  <HashDisplay value={walletAddress} fallback="No account linked" />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Governing Document Reference</p>
                  <HashDisplay value={sub.governingHashHex} fallback="N/A" />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Timestamps</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-muted-foreground">Created:</span>
                    <span className="text-foreground">
                      {sub.createdAt ? new Date(sub.createdAt).toLocaleString() : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-muted-foreground">Settled:</span>
                    <span className="text-foreground">
                      {sub.settledAt ? new Date(sub.settledAt).toLocaleString() : "Not settled"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
