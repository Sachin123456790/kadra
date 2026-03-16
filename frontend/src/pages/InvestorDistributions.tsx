import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getMyDistributions, getInvestorWaterfallBreakdown } from "@/services";
import type { InvestorDistributionLineItem, WaterfallBreakdown } from "@/services/investor-portal.service";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SkeletonCard, TableSkeleton } from "@/components/kadra/Skeleton";
import { Info } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${n}%`;

// ── Waterfall tier definitions ──────────────────────────────

interface WaterfallTier {
  tier: number;
  name: string;
  description: string;
  lpShare: string;
  gpShare: string;
}

const WATERFALL_TIERS: WaterfallTier[] = [
  { tier: 1, name: "Return of Capital", description: "100% of distributions to LPs until contributed capital is returned", lpShare: "100%", gpShare: "0%" },
  { tier: 2, name: "Preferred Return", description: "8% simple annual preferred return to LPs", lpShare: "100%", gpShare: "0%" },
  { tier: 3, name: "GP Catch-up", description: "100% to GP until GP has received 20% of total profits", lpShare: "0%", gpShare: "100%" },
  { tier: 4, name: "Carried Interest", description: "Remaining profits split 80/20", lpShare: "80%", gpShare: "20%" },
];

// ── Tooltip number display ──────────────────────────────────

function TooltipNumber({ value, breakdown }: { value: string; breakdown: string }) {
  const numValue = Number(value);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-gray-400">
            {fmt(numValue)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{breakdown}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Waterfall Breakdown Section ─────────────────────────────

function WaterfallBreakdownSection({
  breakdown,
  distributions,
  selectedRunId,
  onSelectRun,
}: {
  breakdown: WaterfallBreakdown | null;
  distributions: InvestorDistributionLineItem[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
}) {
  const selectedItem = distributions.find((d) => d.run.id === selectedRunId) ?? distributions[0] ?? null;

  const waterfallConfig = breakdown?.waterfallConfig as Record<string, unknown> | undefined;
  const prefRate = waterfallConfig?.preferredReturnRate
    ? `${waterfallConfig.preferredReturnRate}%`
    : "8%";

  return (
    <SectionCard title="Waterfall Breakdown">
      {distributions.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-1">
            Select Distribution Event
          </label>
          <select
            value={selectedRunId ?? selectedItem?.run.id ?? ""}
            onChange={(e) => onSelectRun(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-card"
          >
            {distributions.map((d) => (
              <option key={d.run.id} value={d.run.id}>
                {new Date(d.run.asOfTimestamp).toLocaleDateString()} - {d.run.runStatus}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {WATERFALL_TIERS.map((tier) => (
          <div
            key={tier.tier}
            className="border border-border rounded-lg p-4 bg-muted"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {tier.tier}
              </span>
              <h4 className="text-sm font-semibold text-foreground">{tier.name}</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{tier.description}</p>
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">LP Share: </span>
                <span className="font-medium text-foreground">{tier.lpShare}</span>
              </div>
              <div>
                <span className="text-muted-foreground">GP Share: </span>
                <span className="font-medium text-foreground">{tier.gpShare}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Investor-specific numbers from selected distribution */}
      {selectedItem ? (
        <div className="border border-border rounded-lg p-5 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-sm font-semibold text-foreground">
              Your Distribution — {new Date(selectedItem.run.asOfTimestamp).toLocaleDateString()}
            </h4>
            <StatusBadge status={selectedItem.run.runStatus} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ownership %</p>
              <p className="text-sm font-medium text-foreground">
                {selectedItem.ownershipPctUsed != null ? fmtPct(selectedItem.ownershipPctUsed) : "--"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Return of Capital</p>
              <p className="text-sm font-medium text-foreground">
                <TooltipNumber
                  value={selectedItem.returnOfCapitalAmount}
                  breakdown={`Tier 1: 100% to LP. Your share based on ${selectedItem.ownershipPctUsed ?? 0}% ownership.`}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Preferred Return</p>
              <p className="text-sm font-medium text-foreground">
                <TooltipNumber
                  value={selectedItem.prefAmount}
                  breakdown={`Tier 2: ${prefRate} simple annual preferred return on contributed capital.`}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">GP Promote</p>
              <p className="text-sm font-medium text-foreground">
                <TooltipNumber
                  value={selectedItem.promoteAmount}
                  breakdown="Tier 3-4: GP catch-up and carried interest (20% GP share of profits above pref)."
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gross Amount</p>
              <p className="text-sm font-medium text-foreground">
                <TooltipNumber
                  value={selectedItem.grossAmount}
                  breakdown="Total gross distribution before any withholding or adjustments."
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Net Amount</p>
              <p className="text-lg font-semibold text-foreground">
                <TooltipNumber
                  value={selectedItem.netAmount}
                  breakdown={`Net amount received: Gross (${fmt(Number(selectedItem.grossAmount))}) minus any withholding.`}
                />
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <Info className="h-6 w-6 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Select a distribution event to view your breakdown.</p>
        </div>
      )}
    </SectionCard>
  );
}

// ── Distribution History Table ───────────────────────────────

function DistributionHistoryTable({
  items,
  onRowClick,
}: {
  items: InvestorDistributionLineItem[];
  onRowClick: (item: InvestorDistributionLineItem) => void;
}) {
  const columns: Column<InvestorDistributionLineItem>[] = [
    {
      key: "distributionDate",
      header: "Distribution Date",
      render: (r) => new Date(r.run.asOfTimestamp).toLocaleDateString(),
    },
    {
      key: "runStatus",
      header: "Event Type",
      render: (r) => <StatusBadge status={r.run.runStatus} />,
    },
    {
      key: "returnOfCapitalAmount",
      header: "Capital Returned",
      render: (r) => fmt(Number(r.returnOfCapitalAmount)),
    },
    {
      key: "prefAmount",
      header: "Preferred Return",
      render: (r) => fmt(Number(r.prefAmount)),
    },
    {
      key: "residualShare",
      header: "Residual Share",
      render: (r) => {
        const residual = Number(r.netAmount) - Number(r.returnOfCapitalAmount) - Number(r.prefAmount);
        return fmt(Math.max(0, residual));
      },
    },
    {
      key: "promoteAmount",
      header: "GP Promote",
      render: (r) => fmt(Number(r.promoteAmount)),
    },
    {
      key: "netAmount",
      header: "Total Received",
      render: (r) => (
        <span className="font-semibold">{fmt(Number(r.netAmount))}</span>
      ),
    },
    {
      key: "currency",
      header: "Currency",
    },
    {
      key: "waterfallVersion",
      header: "Waterfall Version",
      render: () => (
        <span className="text-sm text-muted-foreground">1.0</span>
      ),
    },
    {
      key: "id",
      header: "Reference",
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.id.slice(0, 8)}...
        </span>
      ),
    },
  ];

  return (
    <SectionCard title="Distribution History">
      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        onRowClick={onRowClick}
        emptyMessage="No distribution records found."
      />
    </SectionCard>
  );
}

// ── Main Page Component ──────────────────────────────────────

export default function InvestorDistributionsPage() {
  const fundId = DEFAULT_FUND_CODE;
  const waterfallRef = useRef<HTMLDivElement>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: distributions, isLoading: distLoading, error: distError } = useQuery({
    queryKey: QUERY_KEYS.investorDistributions(fundId),
    queryFn: () => getMyDistributions(fundId).then((r) => r.data),
  });

  const { data: breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: QUERY_KEYS.waterfallBreakdown(fundId),
    queryFn: () => getInvestorWaterfallBreakdown(fundId).then((r) => r.data),
  });

  const handleRowClick = useCallback((item: InvestorDistributionLineItem) => {
    setSelectedRunId(item.run.id);
    waterfallRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleSelectRun = useCallback((runId: string) => {
    setSelectedRunId(runId);
  }, []);

  if (distLoading || breakdownLoading) return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <TableSkeleton rows={5} columns={7} />
    </div>
  );
  if (distError) return <ErrorAlert title="Failed to load distributions" message={(distError as Error).message} />;

  const hasDistributions = distributions && distributions.length > 0;

  return (
    <div>
      <PageHeader title="My Distributions" subtitle="Waterfall breakdown and distribution history" />

      {!hasDistributions ? (
        <EmptyState
          title="No distributions yet"
          message="No distributions have been issued to your account yet. Distributions will appear here once the fund begins making payouts."
        />
      ) : (
        <div className="space-y-6">
          {/* Section 1: Waterfall Breakdown */}
          <div ref={waterfallRef}>
            <WaterfallBreakdownSection
              breakdown={breakdown ?? null}
              distributions={distributions}
              selectedRunId={selectedRunId}
              onSelectRun={handleSelectRun}
            />
          </div>

          {/* Section 2: Distribution History */}
          <DistributionHistoryTable
            items={distributions}
            onRowClick={handleRowClick}
          />
        </div>
      )}
    </div>
  );
}
