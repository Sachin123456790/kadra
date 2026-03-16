import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { TableSkeleton } from "@/components/kadra/Skeleton";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getSubscriptions, getInvestors, getDocuments, createSubscriptions } from "@/services";
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
  Mail,
  Bell,
} from "lucide-react";
import { HashDisplay } from "@/components/kadra/HashDisplay";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [investorFilter, setInvestorFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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

  const latestLpa = useMemo(() => {
    if (!documentsData) return null;
    const lpaDocs = documentsData.filter(d => d.documentType === "MASTER_LPA");
    if (lpaDocs.length === 0) return null;
    return lpaDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [documentsData]);

  const latestLpaHash = latestLpa?.hash?.hashHex ?? "";

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
          subscriptionRef: `SUB-${createLpId.slice(0, 6).toUpperCase()}`,
        },
      ]).then(r => r.data);
    },
    onSuccess: () => {
      toast.success("Subscription created successfully");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscriptions(fundId) });
      setShowCreateModal(false);
    },
    onError: (err: Error) => {
      toast.error("Failed to create subscription: " + err.message);
    },
  });

  // ── Derived data
  const statusChartData = useMemo(() => {
    if (!subscriptions) return [];
    const counts: Record<string, number> = {};
    for (const sub of subscriptions) {
      const key = sub.status.toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [subscriptions]);

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

  const allocationStats = useMemo(() => {
    if (!subscriptions || subscriptions.length === 0) return { top3Avg: 0, restAvg: 0 };
    const sorted = [...subscriptions].sort((a, b) => b.allocationPct - a.allocationPct);
    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    const top3Avg = top3.reduce((s, sub) => s + sub.allocationPct, 0) / top3.length;
    const restAvg = rest.length > 0 ? rest.reduce((s, sub) => s + sub.allocationPct, 0) / rest.length : 0;
    return { top3Avg: Math.round(top3Avg * 100) / 100, restAvg: Math.round(restAvg * 100) / 100 };
  }, [subscriptions]);

  const recentActivity = useMemo(() => {
    if (!subscriptions) return [];
    const sorted = [...subscriptions].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return sorted.slice(0, 3);
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
        subtitle="Fund Admin > Subscriptions"
        action={
          <Button
            onClick={() => {
              setCreateLpId("");
              setCreateAmount("");
              setCreateAllocation("");
              setShowCreateModal(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Subscription
          </Button>
        }
      />

      {/* ── Metric cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* Card 1: Status Breakdown */}
        <SectionCard>
          <h3 className="text-sm font-medium text-gray-500 mb-2 text-center">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie
                data={statusChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={50}
              >
                {statusChartData.map(entry => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#fbbf24" }} />
              <span className="text-xs text-gray-600">PENDING: {pendingCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#4f46e5" }} />
              <span className="text-xs text-gray-600">SETTLED: {settledCount}</span>
            </div>
          </div>
        </SectionCard>

        {/* Card 2: Committed Total */}
        <SectionCard>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Committed Total</h3>
          <p className="text-3xl font-bold text-gray-900">{fmt(totalCommitted)}</p>
          <p className="text-sm text-gray-500 mt-1">{subscriptions.length} subscriptions</p>
        </SectionCard>

        {/* Card 3: Settlement Velocity */}
        <SectionCard>
          <h3 className="text-sm font-medium text-gray-500 mb-3">Settlement Velocity</h3>
          <div className="w-full h-2.5 rounded-full bg-gray-200">
            <div
              className="h-2.5 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${settlementPct}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {settlementPct}% Complete (Target 90%)
          </p>
        </SectionCard>

        {/* Card 4: Average Allocation */}
        <SectionCard>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Average Allocation</h3>
          <p className="text-sm text-gray-900">Top 3 Investors Avg: <span className="font-semibold">{allocationStats.top3Avg}%</span></p>
          <p className="text-sm text-gray-900">Rest Avg: <span className="font-semibold">{allocationStats.restAvg}%</span></p>
          <p className="text-xs text-gray-500 mt-2">Recent Activity</p>
          <div className="space-y-0.5 mt-1">
            {recentActivity.map(sub => (
              <p key={sub.subscriptionId} className="text-xs text-gray-600 truncate">
                {sub.investorName || sub.investorId} &mdash; {fmt(Number(sub.committedAmount) || 0)}
              </p>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── Filter bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-1">
          {(["ALL", "PENDING", "SETTLED"] as StatusFilter[]).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                statusFilter === tab
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <select
          value={investorFilter}
          onChange={e => setInvestorFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Investor</option>
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
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Investor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Allocation %</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Committed</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Settled</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Quick Actions</th>
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
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Load More ─────────────────────────────────────────── */}
      <div className="flex justify-center mt-4">
        <Button
          variant="outline"
          size="sm"
          className="text-gray-500"
          onClick={() => toast.info("All subscriptions are already displayed")}
        >
          Load More
        </Button>
      </div>

      {/* ── Create Subscription Modal ─────────────────────────── */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Create Subscription</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a new subscription record for an investor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label htmlFor="lp-select" className="block text-sm font-medium text-gray-700 mb-1">
                Investor (LP)
              </label>
              <select
                id="lp-select"
                value={createLpId}
                onChange={e => setCreateLpId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select an investor...</option>
                {(investorsData ?? []).map((inv: Investor) => (
                  <option key={inv.investorId} value={inv.investorId}>
                    {inv.legalName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="committed-amount" className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="allocation-pct" className="block text-sm font-medium text-gray-700 mb-1">
                Allocation %
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
              disabled={!createLpId || !createAmount || !createAllocation || !latestLpa || createMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Creating..." : "Create Subscription"}
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
}

function SubscriptionTableRow({ sub, isExpanded, walletAddress, onToggle }: SubscriptionTableRowProps) {
  const isPending = sub.status.toUpperCase() === "PENDING";

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-border cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <td className="px-4 py-3 text-gray-500">
          {isExpanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-4 py-3 font-medium text-gray-900">{sub.investorName || sub.investorId}</td>
        <td className="px-4 py-3 text-gray-900">
          <div className="flex items-center gap-2">
            <span>{sub.allocationPct}%</span>
            <div className="w-16 h-1.5 rounded-full bg-gray-200">
              <div
                className="h-1.5 rounded-full bg-emerald-500"
                style={{ width: `${Math.min(sub.allocationPct, 100)}%` }}
              />
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-gray-900">{fmt(Number(sub.committedAmount) || 0)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {statusBadge(sub.status)}
            {isPending && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          </div>
        </td>
        <td className="px-4 py-3 text-gray-500">{sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : "--"}</td>
        <td className="px-4 py-3 text-gray-500">{sub.settledAt ? new Date(sub.settledAt).toLocaleDateString() : "--"}</td>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast.info("Reminder sent to investor")}>
                <Bell className="h-4 w-4 mr-2" />
                Remind Investor
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Opening documents...")}>
                <FileText className="h-4 w-4 mr-2" />
                View Docs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Message sent")}>
                <Mail className="h-4 w-4 mr-2" />
                Message
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
                  <p className="text-xs text-gray-500 mb-0.5">Subscription Reference</p>
                  <p className="text-sm text-gray-900">{sub.subscriptionRef}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Record ID</p>
                  <HashDisplay value={sub.subscriptionId} />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Wallet className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Account Address</p>
                  <HashDisplay value={walletAddress} fallback="No account linked" />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Governing Document Reference</p>
                  <HashDisplay value={sub.governingHashHex} fallback="N/A" />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 mb-0.5">Timestamps</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-500">Created:</span>
                    <span className="text-gray-900">
                      {sub.createdAt ? new Date(sub.createdAt).toLocaleString() : "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-gray-500">Settled:</span>
                    <span className="text-gray-900">
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
