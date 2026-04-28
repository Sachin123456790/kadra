import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/angainor/PageHeader";
import { SectionCard } from "@/components/angainor/SectionCard";
import { DataTable, Column } from "@/components/angainor/DataTable";
import { StatusBadge } from "@/components/angainor/StatusBadge";
import { ErrorAlert } from "@/components/angainor/ErrorAlert";
import { EmptyState } from "@/components/angainor/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getMyDistributions, getInvestorWaterfallBreakdown } from "@/services";
import type { InvestorDistributionLineItem, WaterfallBreakdown } from "@/services/investor-portal.service";
import { DerivedAmount } from "@/components/angainor/DerivedAmount";
import type { DerivationStep } from "@/components/angainor/DerivedAmount";
import { SkeletonCard, TableSkeleton } from "@/components/angainor/Skeleton";
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

interface InvestorWaterfallConfig {
  version?: string;
  prefReturnPct?: number | null;
  rulesJson?: {
    tiers?: Array<{
      name: string;
      hurdle?: string;
      lpShare: number;
      gpShare: number;
    }>;
  };
}

function buildTiersFromConfig(config: InvestorWaterfallConfig): WaterfallTier[] {
  return (config.rulesJson?.tiers ?? []).map((tier, idx) => ({
    tier: idx + 1,
    name: tier.name,
    description: tier.hurdle ?? "",
    lpShare: `${tier.lpShare}%`,
    gpShare: `${tier.gpShare}%`,
  }));
}

// ── Derived amount shortcut ──────────────────────────────────

interface DerivedDistValueProps {
  readonly value: string;
  readonly label: string;
  readonly formula: string;
  readonly steps: ReadonlyArray<DerivationStep>;
  readonly runId?: string;
  readonly asOf?: string;
}

function DerivedDistValue({ value, label, formula, steps, runId, asOf }: DerivedDistValueProps) {
  const numValue = Number(value);
  return (
    <DerivedAmount
      amount={fmt(numValue)}
      label={label}
      formula={formula}
      steps={steps}
      result={fmt(numValue)}
      asOf={asOf}
      sourceDocumentRef={
        runId
          ? {
              id: runId,
              name: "Distribution run",
              route: "/distribution",
            }
          : undefined
      }
    />
  );
}

// ── Waterfall Breakdown Section ─────────────────────────────

function WaterfallBreakdownSection({
  breakdown,
  distributions,
  selectedRunId,
  onSelectRun,
  waterfallConfig,
}: {
  breakdown: WaterfallBreakdown | null;
  distributions: InvestorDistributionLineItem[];
  selectedRunId: string | null;
  onSelectRun: (id: string) => void;
  waterfallConfig: InvestorWaterfallConfig | null;
}) {
  const selectedItem = distributions.find((d) => d.run.id === selectedRunId) ?? distributions[0] ?? null;

  const prefRate =
    typeof waterfallConfig?.prefReturnPct === "number"
      ? `${waterfallConfig.prefReturnPct}%`
      : "—";
  const tiers = waterfallConfig ? buildTiersFromConfig(waterfallConfig) : [];

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
            className="w-full max-w-xs px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring focus:border-primary bg-card"
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
      {!waterfallConfig ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {tiers.map((tier) => (
          <div
            key={tier.tier}
            className="border border-border rounded-lg p-4 bg-muted"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-foreground text-xs font-semibold">
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
      )}

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
                <DerivedDistValue
                  value={selectedItem.returnOfCapitalAmount}
                  label="Return of Capital (Tier 1)"
                  formula="Distribution × LP share × ownership %"
                  steps={[
                    { label: "Tier 1 allocation", value: "100% to LP", formula: "no GP share" },
                    {
                      label: "Your ownership of fund",
                      value: `${selectedItem.ownershipPctUsed ?? 0}%`,
                    },
                    {
                      label: "Your return-of-capital slice",
                      value: fmt(Number(selectedItem.returnOfCapitalAmount)),
                    },
                  ]}
                  runId={selectedItem.run.id}
                  asOf={selectedItem.run.asOfTimestamp}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Preferred Return</p>
              <p className="text-sm font-medium text-foreground">
                <DerivedDistValue
                  value={selectedItem.prefAmount}
                  label="Preferred Return (Tier 2)"
                  formula="Contributed capital × preferred rate × time"
                  steps={[
                    { label: "Preferred rate (LPA)", value: prefRate, formula: "simple annual" },
                    {
                      label: "Your ownership",
                      value: `${selectedItem.ownershipPctUsed ?? 0}%`,
                    },
                    {
                      label: "Your preferred return slice",
                      value: fmt(Number(selectedItem.prefAmount)),
                    },
                  ]}
                  runId={selectedItem.run.id}
                  asOf={selectedItem.run.asOfTimestamp}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">GP Promote</p>
              <p className="text-sm font-medium text-foreground">
                <DerivedDistValue
                  value={selectedItem.promoteAmount}
                  label="GP Promote (Tier 3–4)"
                  formula="GP catch-up + carried interest on profits above pref"
                  steps={[
                    { label: "Tier 3 — GP catch-up", value: "100% to GP until 20% of profits" },
                    { label: "Tier 4 — Carried interest", value: "80/20 LP/GP split" },
                    {
                      label: "Promote attributable to your slice",
                      value: fmt(Number(selectedItem.promoteAmount)),
                    },
                  ]}
                  runId={selectedItem.run.id}
                  asOf={selectedItem.run.asOfTimestamp}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gross Amount</p>
              <p className="text-sm font-medium text-foreground">
                <DerivedDistValue
                  value={selectedItem.grossAmount}
                  label="Gross Distribution"
                  formula="Return of Capital + Preferred Return + Residual (before withholding)"
                  steps={[
                    {
                      label: "Return of capital",
                      value: fmt(Number(selectedItem.returnOfCapitalAmount)),
                      formula: "+",
                    },
                    {
                      label: "Preferred return",
                      value: fmt(Number(selectedItem.prefAmount)),
                      formula: "+",
                    },
                    {
                      label: "Residual (net − pref − RoC)",
                      value: fmt(
                        Math.max(
                          0,
                          Number(selectedItem.netAmount) -
                            Number(selectedItem.returnOfCapitalAmount) -
                            Number(selectedItem.prefAmount),
                        ),
                      ),
                      formula: "+",
                    },
                  ]}
                  runId={selectedItem.run.id}
                  asOf={selectedItem.run.asOfTimestamp}
                />
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Net Amount</p>
              <p className="text-lg font-semibold text-foreground">
                <DerivedDistValue
                  value={selectedItem.netAmount}
                  label="Net Distribution"
                  formula="Gross − withholding/adjustments"
                  steps={[
                    {
                      label: "Gross distribution",
                      value: fmt(Number(selectedItem.grossAmount)),
                      formula: "−",
                    },
                    {
                      label: "Withholding / adjustments",
                      value: fmt(
                        Math.max(
                          0,
                          Number(selectedItem.grossAmount) - Number(selectedItem.netAmount),
                        ),
                      ),
                    },
                  ]}
                  runId={selectedItem.run.id}
                  asOf={selectedItem.run.asOfTimestamp}
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
  waterfallVersion,
}: {
  items: InvestorDistributionLineItem[];
  onRowClick: (item: InvestorDistributionLineItem) => void;
  waterfallVersion: string | null;
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
        <span className="text-sm text-muted-foreground">{waterfallVersion ?? "—"}</span>
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
  const hasFundDistributionContext = Boolean(
    breakdown?.waterfallConfig || breakdown?.distributionRun,
  );
  const waterfallConfig = (breakdown?.waterfallConfig ?? null) as InvestorWaterfallConfig | null;

  return (
    <div>
      <PageHeader title="My Distributions" subtitle="Waterfall breakdown and distribution history" />

      {!hasDistributions && !hasFundDistributionContext ? (
        <EmptyState
          title="No distributions yet"
          message="No distributions have been issued to your account yet. Distributions will appear here once the fund begins making payouts."
        />
      ) : (
        <div className="space-y-6">
          <div ref={waterfallRef}>
            <WaterfallBreakdownSection
              breakdown={breakdown ?? null}
              distributions={distributions ?? []}
              selectedRunId={selectedRunId}
              onSelectRun={handleSelectRun}
              waterfallConfig={waterfallConfig}
            />
          </div>

          {!hasDistributions ? (
            <SectionCard title="Distribution History">
              <EmptyState
                title="No investor distributions yet"
                message={
                  breakdown?.distributionRun
                    ? "The fund has a completed distribution run, but no payout line item was issued to your account in that run."
                    : "The waterfall is configured, but no distribution run has produced a payout for your account yet."
                }
              />
            </SectionCard>
          ) : (
            <DistributionHistoryTable
              items={distributions}
              onRowClick={handleRowClick}
              waterfallVersion={waterfallConfig?.version ?? null}
            />
          )}
        </div>
      )}
    </div>
  );
}
