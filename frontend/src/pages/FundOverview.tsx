import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { KadraTabs } from "@/components/kadra/KadraTabs";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getFundOverview } from "@/services";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function FundOverviewPage() {
  const [tab, setTab] = useState("Overview");
  const fundId = DEFAULT_FUND_CODE;

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.fundOverview(fundId),
    queryFn: () => getFundOverview(fundId).then(r => r.data),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load fund overview" message={(error as Error).message} />;
  if (!data) return <EmptyState title="No fund data" message="Fund overview is not available yet." />;

  const committedCapital = Number(data.totalCommittedAmount) || 0;
  const settledCapital = Number(data.totalSettledAmount) || 0;

  return (
    <div>
      <PageHeader title={data.fundName} subtitle="Fund Overview" />
      <KadraTabs tabs={["Overview", "Performance", "Investors", "Sustainability"]} active={tab} onChange={setTab} />

      {/* Snapshot Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Committed Capital" value={fmt(committedCapital)} />
        <MetricCard label="Settled Capital" value={fmt(settledCapital)} />
        <MetricCard label="Active LPs" value={data.lpCount} />
        <MetricCard label="Pending Subscriptions" value={data.pendingSubscriptions} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Status", value: data.status },
          { label: "Eligible Wallets", value: String(data.eligibleWalletCount) },
          { label: "Settled Subscriptions", value: String(data.settledSubscriptions) },
          { label: "Token Symbol", value: data.tokenContract?.deploymentStatus === "DEPLOYED" ? "KDRA" : "Not deployed" },
          { label: "Contract", value: data.tokenContract?.contractAddress ? `${data.tokenContract.contractAddress.slice(0, 6)}...${data.tokenContract.contractAddress.slice(-4)}` : "N/A" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-card-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Fund Metrics">
          <dl className="space-y-3">
            {[
              ["Total LPs", String(data.lpCount)],
              ["Eligible Wallets", String(data.eligibleWalletCount)],
              ["Pending Subscriptions", String(data.pendingSubscriptions)],
              ["Settled Subscriptions", String(data.settledSubscriptions)],
              ["Committed Capital", fmt(committedCapital)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium text-card-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard title="Token Contract">
          <dl className="space-y-3">
            {[
              ["Deployment Status", data.tokenContract?.deploymentStatus ?? "Not deployed"],
              ["Contract Address", data.tokenContract?.contractAddress ?? "N/A"],
              ["Chain ID", data.tokenContract?.chainId ? String(data.tokenContract.chainId) : "N/A"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium text-card-foreground font-mono text-xs">{v}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
