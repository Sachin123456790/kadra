import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { transfers, Transfer } from "@/data/mockData";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const successCols: Column<Transfer>[] = [
  { key: "fromWallet", header: "From", className: "font-mono text-xs" },
  { key: "toWallet", header: "To", className: "font-mono text-xs" },
  { key: "amount", header: "Amount", render: (r) => fmt(r.amount) },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "txHash", header: "Tx Hash", className: "font-mono text-xs", render: (r) => r.txHash || "—" },
  { key: "timestamp", header: "Date", render: (r) => new Date(r.timestamp).toLocaleDateString() },
];

const failedCols: Column<Transfer>[] = [
  { key: "fromWallet", header: "From", className: "font-mono text-xs" },
  { key: "toWallet", header: "To", className: "font-mono text-xs" },
  { key: "amount", header: "Amount", render: (r) => fmt(r.amount) },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "failureReason", header: "Failure Reason", render: (r) => r.failureReason || "—" },
  { key: "timestamp", header: "Date", render: (r) => new Date(r.timestamp).toLocaleDateString() },
];

const successful = transfers.filter((t) => t.status === "Success");
const failed = transfers.filter((t) => t.status === "Failed");

export default function TransfersPage() {
  return (
    <div>
      <PageHeader title="Transfers" subtitle="Monitor token transfer activity" />
      <div className="space-y-6">
        <SectionCard title={`Failed Transfers (${failed.length})`}>
          <DataTable columns={failedCols} data={failed} getRowId={(r) => r.id} emptyMessage="No failed transfers" />
        </SectionCard>
        <SectionCard title={`Successful Transfers (${successful.length})`}>
          <DataTable columns={successCols} data={successful} getRowId={(r) => r.id} />
        </SectionCard>
      </div>
    </div>
  );
}
