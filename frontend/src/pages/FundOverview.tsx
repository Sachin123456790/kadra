import { useState } from "react";
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { KadraTabs } from "@/components/kadra/KadraTabs";
import { fundOverview } from "@/data/mockData";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function FundOverviewPage() {
  const [tab, setTab] = useState("Overview");
  const f = fundOverview;

  return (
    <div>
      <PageHeader title={f.name} subtitle="Fund Overview" />
      <KadraTabs tabs={["Overview", "Performance", "Investors", "Sustainability"]} active={tab} onChange={setTab} />

      {/* Snapshot Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Committed Capital" value={fmt(f.committedCapital)} />
        <MetricCard label="Settled Capital" value={fmt(f.settledCapital)} />
        <MetricCard label="Active LPs" value={f.activeLPs} />
        <MetricCard label="Pending Subscriptions" value={f.pendingSubscriptions} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Type", value: f.type },
          { label: "Size", value: f.size },
          { label: "Fund Manager", value: f.manager },
          { label: "Status", value: f.status },
          { label: "Vintage", value: f.vintage },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-card-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Fund Structure">
          <dl className="space-y-3">
            {[
              ["Domicile", f.domicile],
              ["Legal Structure", f.legalStructure],
              ["Separate Account", f.separateAccount],
              ["Single Deal Fund", f.singleDealFund],
              ["Continuation Fund", f.continuationFund],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium text-card-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard title="Fund Terms">
          <dl className="space-y-3">
            {[
              ["Annual Management Fee", f.managementFee],
              ["Collection Frequency", f.collectionFrequency],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium text-card-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
