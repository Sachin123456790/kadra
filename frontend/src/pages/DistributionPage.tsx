import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { distributionConfig, distributions, DistributionEntry } from "@/data/mockData";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<DistributionEntry>[] = [
  { key: "investorName", header: "Investor" },
  { key: "ownership", header: "Ownership %", render: (r) => `${r.ownership}%` },
  { key: "grossAllocation", header: "Gross Allocation", render: (r) => fmt(r.grossAllocation) },
  { key: "tier1", header: "Tier 1 (Pref)", render: (r) => fmt(r.tier1) },
  { key: "tier2", header: "Tier 2 (Catch-up)", render: (r) => fmt(r.tier2) },
  { key: "tier3", header: "Tier 3 (Promote)", render: (r) => fmt(r.tier3) },
];

export default function DistributionPage() {
  const dc = distributionConfig;
  return (
    <div>
      <PageHeader title="Distribution" subtitle="Waterfall configuration and distribution preview" />
      <SectionCard title="Waterfall Configuration" className="mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ["Basis", dc.basis],
            ["Frequency", dc.frequency],
            ["Catch-up", dc.catchUp],
            ["GP Promote", dc.gpPromote],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k}</p>
              <p className="mt-1 text-sm text-card-foreground">{v}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Distribution Preview">
        <DataTable columns={columns} data={distributions} getRowId={(r) => r.id} />
      </SectionCard>
    </div>
  );
}
