import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { exportJobs, ExportJob } from "@/data/mockData";

const columns: Column<ExportJob>[] = [
  { key: "id", header: "Export ID", className: "font-mono text-xs" },
  { key: "type", header: "Type" },
  { key: "requestedAt", header: "Requested At", render: (r) => new Date(r.requestedAt).toLocaleString() },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "artifact", header: "Artifact", render: (r) => r.artifact ? <span className="text-xs text-primary font-medium hover:underline cursor-pointer">{r.artifact}</span> : "—" },
];

export default function AuditPage() {
  return (
    <div>
      <PageHeader
        title="Audit & Exports"
        subtitle="Generate compliance packets and download export artifacts"
        action={
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            Generate Audit Packet
          </button>
        }
      />
      <SectionCard>
        <DataTable columns={columns} data={exportJobs} getRowId={(r) => r.id} />
      </SectionCard>
    </div>
  );
}
