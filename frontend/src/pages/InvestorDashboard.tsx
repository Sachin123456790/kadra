import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/angainor/PageHeader";
import { MetricCard } from "@/components/angainor/MetricCard";
import { SectionCard } from "@/components/angainor/SectionCard";
import { ActivityFeed } from "@/components/angainor/ActivityFeed";
import { StatusBadge } from "@/components/angainor/StatusBadge";
import { ErrorAlert } from "@/components/angainor/ErrorAlert";
import { EmptyState } from "@/components/angainor/EmptyState";
import { SkeletonCard } from "@/components/angainor/Skeleton";
import { QUERY_KEYS, ROUTES } from "@/config/constants";
import {
  getMyDashboard,
  getInvestorActivityFeed,
  getInvestorCapitalAccount,
  getMyDistributions,
} from "@/services/investor-portal.service";
import { getMyOnboarding } from "@/services/onboarding.service";
import { useCurrentFund } from "@/hooks/useCurrentFund";
import { useAppConfig } from "@/hooks/useAppConfig";
import { isErrorCode } from "@/lib/errorMessages";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export default function InvestorDashboardPage() {
  const { fundId, fund } = useCurrentFund();
  const { data: appConfig } = useAppConfig();

  // Onboarding gate: if the investor hasn't finished onboarding, bounce to the
  // wizard. Soft-fails if the endpoint 404s (legacy accounts pre-dating the
  // onboarding-row creation); those continue to see the dashboard.
  const { data: onboarding } = useQuery({
    queryKey: ["investor", "onboarding"],
    queryFn: () => getMyOnboarding().then((r) => r.data),
    retry: false,
  });

  const {
    data: dashboard,
    isLoading: dashLoading,
    error: dashError,
  } = useQuery({
    queryKey: QUERY_KEYS.investorDashboard(fundId),
    queryFn: () => getMyDashboard(fundId).then((r) => r.data),
  });

  const { data: capitalAccount } = useQuery({
    queryKey: QUERY_KEYS.investorCapitalAccount(fundId),
    queryFn: () => getInvestorCapitalAccount(fundId).then((r) => r.data),
  });

  const { data: distributions } = useQuery({
    queryKey: QUERY_KEYS.investorDistributions(fundId),
    queryFn: () => getMyDistributions(fundId).then((r) => r.data),
  });

  const { data: activityEvents, isLoading: actLoading } = useQuery({
    queryKey: QUERY_KEYS.investorActivityFeed(fundId),
    queryFn: () => getInvestorActivityFeed(fundId).then((r) => r.data),
  });

  if (onboarding && !onboarding.completed) {
    return <Navigate to={ROUTES.INVESTOR_ONBOARDING} replace />;
  }

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
  if (dashError) {
    if (isErrorCode(dashError, "INVESTOR_NOT_FOUND")) {
      return <Navigate to={ROUTES.INVESTOR_ONBOARDING} replace />;
    }
    return (
      <ErrorAlert
        title="Failed to load portfolio"
        message={(dashError as Error).message}
      />
    );
  }
  if (!dashboard || !dashboard.summary)
    return (
      <EmptyState
        title="No portfolio data"
        message="Your portfolio overview is not available yet."
      />
    );

  const { summary, investor, subscriptions, eligibility } = dashboard;
  const fundName = fund?.fundName ?? appConfig?.defaults.fundName ?? "—";
  const activeEligibility = (eligibility ?? []).find(
    (e) => e.eligibilityStatus === "ELIGIBLE" && !e.revokedAt,
  );
  const isEligible = Boolean(activeEligibility);
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
    (s) => s.status?.toUpperCase() === "SETTLED",
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
        />
        <MetricCard
          label="Total Distributions"
          value={fmt(totalDistributions)}
        />
        <MetricCard
          label="Capital Account Balance"
          value={fmt(endingBalance)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Portfolio Summary */}
        <SectionCard title="Portfolio Summary">
          <dl className="space-y-3">
            <SummaryRow label="Fund Name" value={fundName} />
            <SummaryRow
              label="Legal Entity Name"
              value={investor.legalName}
            />
            <SummaryRow
              label="Fund Eligibility"
              value={
                isEligible ? (
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                    Eligible
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                    Not Eligible
                  </span>
                )
              }
            />
            <SummaryRow
              label="Ownership"
              value={
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[120px]">
                    <div
                      className="h-full rounded-full bg-primary"
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
            viewAllLink={ROUTES.NOTIFICATIONS}
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
