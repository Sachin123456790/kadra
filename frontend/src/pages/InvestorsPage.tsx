import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { investors, Investor } from "@/data/mockData";

const columns: Column<Investor>[] = [
  { key: "name", header: "Investor Name" },
  { key: "wallet", header: "Wallet Address", className: "font-mono text-xs" },
  { key: "verificationStatus", header: "Status", render: (r) => <StatusBadge status={r.verificationStatus} /> },
  { key: "fundEligibility", header: "Fund Eligibility" },
  { key: "ownership", header: "Ownership %", render: (r) => `${r.ownership}%` },
  { key: "actions", header: "Actions", render: () => <button className="text-xs text-primary font-medium hover:underline">View</button> },
];

export default function InvestorsPage() {
  return (
    <div>
      <PageHeader title="Investors" subtitle="Manage fund investors and verification status" />
      <SectionCard>
        <DataTable columns={columns} data={investors} getRowId={(r) => r.id} />
      </SectionCard>
    </div>
  );
}
