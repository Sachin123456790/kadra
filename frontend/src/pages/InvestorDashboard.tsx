import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { ActivityFeed } from "@/components/kadra/ActivityFeed";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { SkeletonCard } from "@/components/kadra/Skeleton";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import {
  getMyDashboard,
  getInvestorActivityFeed,
  getInvestorCapitalAccount,
  getMyDistributions,
} from "@/services/investor-portal.service";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export default function InvestorDashboardPage() {
  const fundId = DEFAULT_FUND_CODE;

  const {
    data: dashboard,
    isLoading: dashLoading,
    error: dashError,
  } = useQuery({
    queryKey: QUERY_KEYS.investorDashboard(fundId),
    queryFn: () => getMyDashboard(fundId).then((r) => r.data),
  });

  const { data: capitalAccount, isLoading: caLoading } = useQuery({
    queryKey: QUERY_KEYS.investorCapitalAccount(fundId),
    queryFn: () => getInvestorCapitalAccount(fundId).then((r) => r.data),
  });

  const { data: distributions, isLoading: distLoading } = useQuery({
    queryKey: QUERY_KEYS.investorDistributions(fundId),
    queryFn: () => getMyDistributions(fundId).then((r) => r.data),
  });

  const { data: activityEvents, isLoading: actLoading } = useQuery({
    queryKey: QUERY_KEYS.investorActivityFeed(fundId),
    queryFn: () => getInvestorActivityFeed(fundId).then((r) => r.data),
  });

  if (dashLoading) return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );
  if (dashError)
    return (
      <ErrorAlert
        title="Failed to load portfolio"
        message={(dashError as Error).message}
      />
    );
  if (!dashboard || !dashboard.summary)
    return (
      <EmptyState
        title="No portfolio data"
        message="Your portfolio overview is not available yet."
      />
    );

  const { summary, investor, subscriptions } = dashboard;
  const ownershipPct = summary.ownershipPct;
  const totalCommitted = Number(summary.totalCommitted);
  const totalSettled = Number(summary.totalSettled);

  const accruedPref = capitalAccount
    ? Number(capitalAccount.accruedPreferredReturn)
    : 0;
  const endingBalance = capitalAccount
    ? Number(capitalAccount.endingBalance)
    : 0;
  const totalDistributions = (distributions ?? []).reduce(
    (sum, d) => sum + Number(d.netAmount),
    0,
  );

  const settledCount = subscriptions.filter(
    (s) => s.status === "Settled",
  ).length;
  const settlementStatus =
    settledCount === subscriptions.length && subscriptions.length > 0
      ? "Settled"
      : settledCount > 0
        ? "Partial"
        : "Pending";

  const capitalContributed = capitalAccount
    ? Number(capitalAccount.initialContribution)
    : 0;

  return (
    <div>
      <PageHeader
        title="Portfolio Overview"
        subtitle="Your investment summary"
      />

      {/* Top Metric Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <MetricCard
          label="Ownership"
          value={`${ownershipPct.toFixed(1)}%`}
          subtitle="Current fund ownership"
        />
        <MetricCard
          label="Total Committed"
          value={fmt(totalCommitted)}
          subtitle="Capital commitment"
        />
        <MetricCard
          label="Total Settled"
          value={fmt(totalSettled)}
          subtitle="Capital settled"
        />
      </div>

      {/* Bottom Metric Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard
          label="Accrued Preferred Return"
          value={fmt(accruedPref)}
          subtitle={caLoading ? "Loading..." : undefined}
        />
        <MetricCard
          label="Total Distributions"
          value={fmt(totalDistributions)}
          subtitle={distLoading ? "Loading..." : undefined}
        />
        <MetricCard
          label="Capital Account Balance"
          value={fmt(endingBalance)}
          subtitle={caLoading ? "Loading..." : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Portfolio Summary */}
        <SectionCard title="Portfolio Summary">
          <dl className="space-y-3">
            <SummaryRow label="Fund Name" value="Angainor Demo Fund I" />
            <SummaryRow
              label="Legal Entity Name"
              value={investor.legalName}
            />
            <SummaryRow
              label="Fund Eligibility"
              value={
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                  Eligible
                </span>
              }
            />
            <SummaryRow
              label="Ownership"
              value={
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[120px]">
                    <div
                      className="h-full rounded-full bg-indigo-600"
                      style={{ width: `${Math.min(ownershipPct, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {ownershipPct.toFixed(1)}%
                  </span>
                </div>
              }
            />
            <SummaryRow
              label="Settlement Status"
              value={<StatusBadge status={settlementStatus} />}
            />
            <SummaryRow
              label="Capital Contributed"
              value={fmt(capitalContributed)}
            />
            <SummaryRow
              label="Accrued Preferred Return"
              value={fmt(accruedPref)}
            />
            <SummaryRow
              label="Distributions Received"
              value={fmt(totalDistributions)}
            />
            <SummaryRow
              label="Capital Account Balance"
              value={fmt(endingBalance)}
            />
          </dl>
        </SectionCard>

        {/* Panel 2: Activity Feed */}
        <SectionCard title="Activity Feed">
          <ActivityFeed
            events={activityEvents ?? []}
            isLoading={actLoading}
            maxItems={10}
            showViewAll
            viewAllLink="/investor/documents"
          />
        </SectionCard>
      </div>
    </div>
  );
}

/* ── Helper Component ── */

function SummaryRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">
        {typeof value === "string" || typeof value === "number" ? value : value}
      </dd>
    </div>
  );
}
