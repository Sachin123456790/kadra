import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getSubscriptions, getInvestors, getDocuments } from "@/services";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Copy, Plus, Wallet, FileText, Calendar, Clock } from "lucide-react";
import type { Subscription } from "@/services/subscriptions.service";
import type { Investor } from "@/services/investors.service";

// ── Helpers ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  SETTLED: "#4f46e5",
  PENDING: "#fbbf24",
  MISMATCH: "#f59e0b",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function truncateId(id: string, len = 8): string {
  if (!id || id.length <= len * 2) return id;
  return `${id.slice(0, len)}...${id.slice(-4)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
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

// ── Main component ──────────────────────────────────────────

export default function SubscriptionsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const fundId = DEFAULT_FUND_CODE;

  // ── Create subscription form state ─────────────────────────
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

  // Find the latest LPA document
  const latestLpa = useMemo(() => {
    if (!documentsData) return null;
    const lpaDocs = documentsData.filter(d => d.documentType === "MASTER_LPA");
    if (lpaDocs.length === 0) return null;
    return lpaDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }, [documentsData]);

  const latestLpaHash = latestLpa?.hash?.hashHex ?? "";

  const statusChartData = useMemo(() => {
    if (!subscriptions) return [];
    const counts: Record<string, number> = {};
    for (const sub of subscriptions) {
      const key = sub.status.toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [subscriptions]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load subscriptions" message={(error as Error).message} />;
  if (!subscriptions || subscriptions.length === 0) return <EmptyState title="No subscriptions" message="No subscription records exist yet." />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader
          title="Subscriptions"
          subtitle="Track subscription commitments and settlement status"
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
        <SectionCard className="w-full sm:w-72 flex-shrink-0">
          <h3 className="text-sm font-medium text-gray-500 mb-2 text-center">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={statusChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
              >
                {statusChartData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Subscriptions Table with expandable rows */}
      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Record ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ref</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Investor</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Allocation %</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Committed</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">LPA Hash</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Settled</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub: Subscription) => {
                const isExpanded = expandedId === sub.subscriptionId;
                // Find investor details for the expanded row
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

      {/* Create Subscription Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Create Subscription</DialogTitle>
            <DialogDescription className="text-gray-500">
              Add a new subscription record for an investor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* LP Selector */}
            <div>
              <label htmlFor="lp-select" className="block text-sm font-medium text-gray-700 mb-1">
                Investor (LP)
              </label>
              <select
                id="lp-select"
                value={createLpId}
                onChange={(e) => setCreateLpId(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select an investor...</option>
                {(investorsData ?? []).map((inv: Investor) => (
                  <option key={inv.investorId} value={inv.investorId}>
                    {inv.legalName}
                  </option>
                ))}
              </select>
            </div>

            {/* Committed Amount */}
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
                onChange={(e) => setCreateAmount(e.target.value)}
                placeholder="e.g. 2000000"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Allocation % */}
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
                onChange={(e) => setCreateAllocation(e.target.value)}
                placeholder="e.g. 20"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* LPA Reference (auto-populated) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LPA Reference
              </label>
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                {latestLpaHash ? (
                  <span className="font-mono text-xs text-gray-900 truncate">{truncateId(latestLpaHash, 12)}</span>
                ) : (
                  <span className="text-sm text-gray-500">No LPA document uploaded</span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!createLpId || !createAmount || !createAllocation}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => {
                // Form ready - submission would call createSubscriptions service
                setShowCreateModal(false);
              }}
            >
              Create Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Expandable subscription row ─────────────────────────────

function SubscriptionTableRow({
  sub,
  isExpanded,
  walletAddress,
  onToggle,
}: {
  sub: Subscription;
  isExpanded: boolean;
  walletAddress: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <td className="px-4 py-3 text-gray-500">
          {isExpanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center gap-1">
            <span className="font-mono text-xs text-gray-900">{truncateId(sub.subscriptionId)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(sub.subscriptionId); }}
              className="text-gray-400 hover:text-gray-600 p-0.5"
              title="Copy subscription ID"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </span>
        </td>
        <td className="px-4 py-3 text-gray-900">{sub.subscriptionRef}</td>
        <td className="px-4 py-3 text-gray-900">{sub.investorName || sub.investorId}</td>
        <td className="px-4 py-3 text-gray-900">{sub.allocationPct}%</td>
        <td className="px-4 py-3 text-gray-900">{fmt(Number(sub.committedAmount) || 0)}</td>
        <td className="px-4 py-3">{statusBadge(sub.status)}</td>
        <td className="px-4 py-3 font-mono text-xs text-gray-600">{sub.governingHashHex ? truncateId(sub.governingHashHex) : "--"}</td>
        <td className="px-4 py-3 text-gray-600">{sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : "--"}</td>
        <td className="px-4 py-3 text-gray-600">{sub.settledAt ? new Date(sub.settledAt).toLocaleDateString() : "--"}</td>
      </tr>

      {/* Expanded detail row */}
      {isExpanded && (
        <tr className="bg-gray-50/50">
          <td colSpan={10} className="px-8 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Wallet Address */}
              <div className="flex items-start gap-3">
                <Wallet className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Wallet Address</p>
                  <p className="text-sm font-mono text-gray-900">
                    {walletAddress || "No wallet linked"}
                  </p>
                </div>
              </div>

              {/* Governing Document Reference */}
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Governing Document Reference (LPA Hash)</p>
                  <p className="text-sm font-mono text-gray-900 break-all">
                    {sub.governingHashHex || "N/A"}
                  </p>
                </div>
              </div>

              {/* Full Subscription Record ID */}
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Full Subscription Record ID</p>
                  <p className="text-sm font-mono text-gray-900 break-all">
                    {sub.subscriptionId}
                  </p>
                </div>
              </div>

              {/* Timestamps */}
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
