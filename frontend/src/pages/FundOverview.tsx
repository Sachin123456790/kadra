import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { SkeletonCard, TableSkeleton } from "@/components/kadra/Skeleton";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import { ActivityFeed } from "@/components/kadra/ActivityFeed";
import { TechnicalDetails } from "@/components/kadra/TechnicalDetails";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { QUERY_KEYS, DEFAULT_FUND_CODE, ROUTES } from "@/config/constants";
import { getFundOverview, getActivityFeed, getDocuments } from "@/services";
import { getCapitalCalls } from "@/services/capital-calls.service";
import { getCapitalAccounts } from "@/services/ownership.service";
import { formatCompact, formatEventType } from "@/lib/format";

const IDENTITY_REGISTRY_ADDRESS = "0x55822888507cac67bE5C11516e00C4597E7c78fb";

// Demo fund target size ($5M). Used as the denominator for the Committed progress bar
// so it does not trivially show 100% by comparing committed capital against itself.
const DEMO_FUND_TARGET_SIZE = 5_000_000;

/* ── Formatters ── */

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

/* ── Progress Bar ── */

interface ProgressBarProps {
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly color: string;
}

function ProgressBar({ label, value, max, color }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{fmt(value)}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ── Info Row helper ── */

function InfoRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between border-b border-border pb-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

/* ── Main Page ── */

export default function FundOverviewPage() {
  const fundId = DEFAULT_FUND_CODE;

  /* ── Queries ── */

  const {
    data: fundData,
    isLoading: fundLoading,
    error: fundError,
  } = useQuery({
    queryKey: QUERY_KEYS.fundOverview(fundId),
    queryFn: () => getFundOverview(fundId).then((r) => r.data),
  });

  const { data: activityEvents, isLoading: activityLoading } = useQuery({
    queryKey: QUERY_KEYS.activityFeed(fundId),
    queryFn: () => getActivityFeed(fundId, 20).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: capitalCalls } = useQuery({
    queryKey: QUERY_KEYS.capitalCalls(fundId),
    queryFn: () => getCapitalCalls(fundId).then((r) => r.data),
  });

  const { data: capitalAccounts } = useQuery({
    queryKey: QUERY_KEYS.capitalAccounts(fundId),
    queryFn: () => getCapitalAccounts(fundId).then((r) => r.data),
  });

  const { data: documents } = useQuery({
    queryKey: QUERY_KEYS.documents(fundId),
    queryFn: () => getDocuments(fundId).then((r) => r.data),
  });

  /* ── Derived values ── */

  const metrics = useMemo(() => {
    if (!fundData) return null;

    const committedCapital = Number(fundData.totalCommittedAmount) || 0;
    const settledCapital = Number(fundData.totalSettledAmount) || 0;

    const calledCapital =
      capitalCalls?.reduce((sum, cc) => sum + (Number(cc.amountDue) || 0), 0) ?? 0;

    const totalDistributed = 0; // No on-chain distributions in demo
    const totalReturns = totalDistributed;

    const totalAccruedPrefReturn =
      capitalAccounts?.reduce(
        (sum, ca) => sum + (Number(ca.accruedPreferredReturn) || 0),
        0,
      ) ?? 0;

    const unfundedCommitments = committedCapital - settledCapital;

    const nextCapitalCallDueDate = capitalCalls
      ?.filter((cc) => cc.status !== "COMPLETED" && cc.status !== "CANCELLED")
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
      ?.dueDate ?? null;

    return {
      committedCapital,
      settledCapital,
      calledCapital,
      totalDistributed,
      totalReturns,
      totalAccruedPrefReturn,
      unfundedCommitments,
      nextCapitalCallDueDate,
    };
  }, [fundData, capitalCalls, capitalAccounts]);

  /* ── Loading / Error / Empty ── */

  if (fundLoading) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <TableSkeleton rows={5} columns={4} />
    </div>
  );
  if (fundError)
    return (
      <ErrorAlert
        title="Unable to load fund overview"
        message={`${(fundError as Error).message}. Please refresh the page or contact support if the issue persists.`}
      />
    );
  if (!fundData || !metrics)
    return (
      <EmptyState title="No fund data" message="Fund overview is not available yet." />
    );

  const isDeployed = fundData.tokenContract?.deploymentStatus === "DEPLOYED";
  const fundSize = DEMO_FUND_TARGET_SIZE;
  const isFullyCommitted = metrics.committedCapital >= fundSize && fundSize > 0;

  // Find the governing document (Master LPA) hash for waterfall version link
  const governingDoc = documents?.find((d) => d.documentType === "MASTER_LPA");
  const governingDocHash = governingDoc?.hash?.hashHex ?? null;

  /* ── Last on-chain event ── */
  const lastOnChainEvent = activityEvents
    ?.filter((e) => e.txHash)
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )[0] ?? null;

  return (
    <div>
      <PageHeader title={fundData.fundName} subtitle="Overview of fund status, capital activity, and recent events" />

      {/* ── Top Metric Bar (4 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <MetricCard
          label="Total AUM"
          value={formatCompact(metrics.settledCapital)}
          subtitle={
            isFullyCommitted
              ? <span className="text-green-600 dark:text-green-400">Fully Committed</span>
              : <span className="text-amber-600 dark:text-amber-400">Partially Committed</span>
          }
          className="[&>p:nth-child(2)]:text-3xl"
        />
        <MetricCard
          label="Fund Size"
          value={formatCompact(fundSize)}
          subtitle="Target Commitment"
          className="[&>p:nth-child(2)]:text-3xl"
        />
        <MetricCard
          label="Active Investors"
          value={fundData.lpCount}
          subtitle={`of ${(fundData.lpCount ?? 0) + (fundData.pendingSubscriptions ?? 0)} total`}
          className="[&>p:nth-child(2)]:text-3xl"
        />
        <MetricCard
          label="Pending Settlements"
          value={fundData.pendingSubscriptions}
          subtitle={
            (fundData.pendingSubscriptions ?? 0) === 0
              ? <span className="text-green-600 dark:text-green-400">All settled</span>
              : <span className="text-amber-600 dark:text-amber-400">{fundData.pendingSubscriptions} awaiting confirmation</span>
          }
          className="[&>p:nth-child(2)]:text-3xl"
        />
      </div>

      {/* ── Bottom Metric Bar (5 cards) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard label="Committed Capital" value={formatCompact(metrics.committedCapital)} />
        <MetricCard label="Called Capital" value={formatCompact(metrics.calledCapital)} />
        <MetricCard label="Settled Capital" value={formatCompact(metrics.settledCapital)} />
        <MetricCard label="Total Distributed" value={formatCompact(metrics.totalDistributed)} />
        <MetricCard label="Total Returns" value={formatCompact(metrics.totalReturns)} />
      </div>

      {/* ── 2x2 Panel Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Fund Status */}
        <SectionCard title="Fund Status">
          <dl className="space-y-3">
            <InfoRow label="Fund Name">{fundData.fundName}</InfoRow>
            <InfoRow label="Legal Form">Limited Partnership</InfoRow>
            <InfoRow label="Status">
              <StatusBadge status={fundData.status === "ACTIVE" ? "Passed" : fundData.status} />
            </InfoRow>
            <InfoRow label="Transfer Restrictions">
              <span className="inline-flex items-center gap-1.5 text-green-700 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Enforced
              </span>
            </InfoRow>
            <InfoRow label="Waterfall Version">
              {governingDocHash ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help border-b border-dashed border-gray-400 text-indigo-600">
                      1.0
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs">
                      Linked to LPA hash:{" "}
                      <span className="font-mono">{governingDocHash.slice(0, 12)}...{governingDocHash.slice(-8)}</span>
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                "1.0"
              )}
            </InfoRow>
          </dl>
          <TechnicalDetails label="Blockchain Details">
            <dl className="space-y-3">
              <InfoRow label="Contract Address">
                {fundData.tokenContract?.contractAddress ? (
                  <ExplorerLink
                    value={fundData.tokenContract.contractAddress}
                    type="address"
                  />
                ) : (
                  <span className="text-gray-400">Not deployed</span>
                )}
              </InfoRow>
              <InfoRow label="Identity Registry">
                <ExplorerLink
                  value={IDENTITY_REGISTRY_ADDRESS}
                  type="address"
                />
              </InfoRow>
            </dl>
          </TechnicalDetails>
        </SectionCard>

        {/* Panel 2: Activity Feed */}
        <SectionCard
          title="Activity Feed"
          action={
            <a
              href={ROUTES.AUDIT}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              View All
            </a>
          }
        >
          <div className="relative">
            <div className="max-h-64 overflow-y-auto">
              <ActivityFeed
                events={activityEvents ?? []}
                isLoading={activityLoading}
                maxItems={20}
                showViewAll={false}
                viewAllLink={ROUTES.AUDIT}
              />
            </div>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent dark:from-card" />
          </div>
          <div className="border-t border-border pt-3 mt-3 text-center">
            <a
              href={ROUTES.AUDIT}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              View All Events
            </a>
          </div>
        </SectionCard>

        {/* Panel 3: Capital Summary */}
        <SectionCard title="Capital Summary">
          <div className="space-y-4">
            <ProgressBar
              label="Committed"
              value={metrics.committedCapital}
              max={fundSize}
              color="bg-indigo-600"
            />
            <ProgressBar
              label="Called"
              value={metrics.calledCapital}
              max={fundSize}
              color="bg-blue-500"
            />
            <ProgressBar
              label="Settled"
              value={metrics.settledCapital}
              max={fundSize}
              color="bg-green-500"
            />

            <div className="border-t border-border pt-4">
              <dl className="space-y-3">
                {/* GP Promote is $0 — correct for demo since no distributions have been run yet */}
                <InfoRow label="GP Promote Accrued">{fmt(0)}</InfoRow>
                <InfoRow label="Total Preferred Return Accrued">
                  {fmt(metrics.totalAccruedPrefReturn)}
                </InfoRow>
                <InfoRow label="Next Capital Call Due Date">
                  {metrics.nextCapitalCallDueDate
                    ? new Date(metrics.nextCapitalCallDueDate).toLocaleDateString()
                    : "None scheduled"}
                </InfoRow>
                <InfoRow label="Unfunded Commitments">
                  {fmt(metrics.unfundedCommitments)}
                </InfoRow>
              </dl>
            </div>
          </div>
        </SectionCard>

        {/* Panel 4: Fund Administration */}
        <SectionCard title="Fund Administration">
          <dl className="space-y-3">
            <InfoRow label="Fund Name">{fundData.fundName}</InfoRow>
            <InfoRow label="Legal Form">Limited Partnership</InfoRow>
            <InfoRow label="System Status">
              <StatusBadge status={isDeployed ? "Completed" : "Pending"} />
            </InfoRow>
            <InfoRow label="Transfer Restrictions">
              <span className="inline-flex items-center gap-1.5 text-green-700 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Enforced
              </span>
            </InfoRow>
          </dl>
          <TechnicalDetails label="Blockchain Details">
            <dl className="space-y-3">
              <InfoRow label="Contract Address">
                {fundData.tokenContract?.contractAddress ? (
                  <ExplorerLink
                    value={fundData.tokenContract.contractAddress}
                    type="address"
                  />
                ) : (
                  <span className="text-gray-400">N/A</span>
                )}
              </InfoRow>
              <InfoRow label="Identity Registry">
                <ExplorerLink
                  value={IDENTITY_REGISTRY_ADDRESS}
                  type="address"
                />
              </InfoRow>
              <InfoRow label="Total Units Issued">
                {isDeployed ? "10,000 KDRA" : "N/A"}
              </InfoRow>
              <InfoRow label="Units Outstanding">
                {isDeployed ? "10,000 KDRA" : "N/A"}
              </InfoRow>
              <InfoRow label="Last Recorded Event">
                {lastOnChainEvent ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs font-medium text-gray-700">
                      {formatEventType(lastOnChainEvent.eventType)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(lastOnChainEvent.occurredAt).toLocaleDateString()}{" "}
                      {new Date(lastOnChainEvent.occurredAt).toLocaleTimeString()}
                    </span>
                    {lastOnChainEvent.txHash && (
                      <ExplorerLink value={lastOnChainEvent.txHash} type="tx" />
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400">None</span>
                )}
              </InfoRow>
            </dl>
          </TechnicalDetails>
        </SectionCard>
      </div>
    </div>
  );
}
