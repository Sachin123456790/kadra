import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/kadra/PageHeader";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import {
  getInvestorDocuments,
  type InvestorDocument,
} from "@/services/investor-portal.service";

/* ── Document type badge colors ── */

const TYPE_BADGE_STYLES: Record<string, string> = {
  SUBSCRIPTION_AGREEMENT: "bg-indigo-50 text-indigo-700",
  PAYMENT_CONFIRMATION: "bg-green-50 text-green-700",
  CAPITAL_CALL_NOTICE: "bg-amber-50 text-amber-700",
  DISTRIBUTION_NOTICE: "bg-blue-50 text-blue-700",
  QUARTERLY_STATEMENT: "bg-purple-50 text-purple-700",
};

const TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION_AGREEMENT: "Subscription Agreement",
  PAYMENT_CONFIRMATION: "Payment Confirmation",
  CAPITAL_CALL_NOTICE: "Capital Call Notice",
  DISTRIBUTION_NOTICE: "Distribution Notice",
  QUARTERLY_STATEMENT: "Quarterly Statement",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  AVAILABLE: "bg-green-50 text-green-700",
  PENDING: "bg-amber-50 text-amber-700",
  PROCESSING: "bg-blue-50 text-blue-700",
  ARCHIVED: "bg-gray-100 text-gray-600",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

function TypeBadge({ type }: { readonly type: string }) {
  const style = TYPE_BADGE_STYLES[type] ?? "bg-gray-100 text-gray-600";
  const label = TYPE_LABELS[type] ?? type.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}

function StatusBadgeDoc({ status }: { readonly status: string }) {
  const style = STATUS_BADGE_STYLES[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function EmptyDocuments() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="h-12 w-12 text-indigo-300 mb-4" strokeWidth={1.5} />
      <p className="text-sm font-medium text-gray-600">
        No documents available yet
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Your legal documents will appear here once they are generated.
      </p>
    </div>
  );
}

const columns: Column<InvestorDocument>[] = [
  {
    key: "name",
    header: "Document Name",
    render: (row) => (
      <span className="text-sm font-medium text-gray-900">{row.name}</span>
    ),
  },
  {
    key: "type",
    header: "Type",
    render: (row) => <TypeBadge type={row.type} />,
  },
  {
    key: "createdAt",
    header: "Date Generated",
    render: (row) => (
      <span className="text-sm text-gray-600">{fmtDate(row.createdAt)}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadgeDoc status={row.status} />,
  },
  {
    key: "download",
    header: "Download",
    render: (row) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (row.downloadable) {
            alert("Download will be available soon.");
          }
        }}
        disabled={!row.downloadable}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          row.downloadable
            ? "text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
            : "text-gray-400 bg-gray-50 cursor-not-allowed"
        }`}
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
    ),
  },
];

export default function InvestorDocuments() {
  const fundId = DEFAULT_FUND_CODE;

  const { data: documents, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorDocuments(fundId),
    queryFn: () => getInvestorDocuments(fundId).then((r) => r.data),
  });

  if (isLoading) return <div className="p-6 text-gray-500">Loading...</div>;
  if (error)
    return (
      <ErrorAlert
        title="Failed to load documents"
        message={(error as Error).message}
      />
    );

  const docs = documents ?? [];

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Your legal document vault"
      />

      {docs.length === 0 ? (
        <EmptyDocuments />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <DataTable
            columns={columns}
            data={docs}
            getRowId={(r) => r.id}
            emptyMessage="No documents available"
          />
        </div>
      )}
    </div>
  );
}
