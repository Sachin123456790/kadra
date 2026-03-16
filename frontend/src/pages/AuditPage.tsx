import { useState, useCallback } from "react";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import { DEFAULT_FUND_CODE, QUERY_KEYS } from "@/config/constants";
import {
  createAuditExport,
  getAuditExport,
  downloadAuditExport,
  getDocuments,
  getCapTable,
  getSubscriptions,
  getFailedTransfers,
  getSuccessfulTransfers,
} from "@/services";
import {
  getEventLog,
  getDocumentProvenance,
} from "@/services/audit.service";
import type {
  AuditExportDetail,
  EventLogEntry,
  DocumentProvenance,
} from "@/services/audit.service";
import { verifyDocument } from "@/services/documents.service";
import { getCapitalAccounts } from "@/services/ownership.service";
import { getNotices } from "@/services/notices.service";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { TableSkeleton } from "@/components/kadra/Skeleton";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import {
  CheckCircle,
  Circle,
  Loader2,
} from "lucide-react";
import { CopyButton } from "@/components/kadra/CopyButton";
import { formatEventType } from "@/lib/format";

// ── Helpers ──────────────────────────────────────────────

function truncateHash(hash: string | number | null | undefined): string {
  if (hash == null) return "--";
  const s = String(hash);
  if (s.length <= 16) return s || "--";
  return `${s.slice(0, 10)}...${s.slice(-6)}`;
}

function triggerCsvDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Event Log Section ────────────────────────────────────

const EVENT_LOG_PAGE_SIZE = 50;

function EventLogSection({ fundId }: { readonly fundId: string }) {
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: [...QUERY_KEYS.eventLog(fundId), page],
    queryFn: () =>
      getEventLog(fundId, EVENT_LOG_PAGE_SIZE, page * EVENT_LOG_PAGE_SIZE).then(
        (r) => r.data,
      ),
  });

  const events = data ?? [];

  const columns: Column<EventLogEntry>[] = [
    {
      key: "eventType",
      header: "Event Type",
      render: (r) => <StatusBadge status={formatEventType(r.eventType)} />,
    },
    {
      key: "actor",
      header: "Actor",
      render: (r) => {
        const actor =
          (r.metadata?.actor as string) ??
          (r.metadata?.userId as string) ??
          "System";
        return <span className="text-sm text-gray-700">{actor}</span>;
      },
    },
    {
      key: "occurredAt",
      header: "Timestamp",
      render: (r) => (
        <span className="text-muted-foreground">
          {new Date(r.occurredAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "txHash",
      header: "Verification",
      render: (r) => {
        if (r.txHash) {
          return (
            <span className="inline-flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs">Verified</span>
            </span>
          );
        }
        const docHash =
          (r.metadata?.documentHash as string) ??
          (r.payload?.documentHash as string) ??
          null;
        if (docHash) {
          return (
            <span className="inline-flex items-center gap-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs">Hashed</span>
            </span>
          );
        }
        return <span className="text-gray-400">--</span>;
      },
    },
  ];

  return (
    <SectionCard title="Event and Evidence Log" className="mb-6">
      {isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : error ? (
        <ErrorAlert
          title="Unable to load event log"
          message={`${(error as Error).message}. Try refreshing the page.`}
        />
      ) : events.length === 0 ? (
        <EmptyState
          title="No events"
          message="No events have been recorded yet."
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={events}
            getRowId={(r) => String(r.id)}
          />
          <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-muted-foreground">Page {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={events.length < EVENT_LOG_PAGE_SIZE}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ── Document Provenance Section ──────────────────────────

function DocumentProvenanceSection({
  fundId,
}: {
  readonly fundId: string;
}) {
  const [verifyState, setVerifyState] = useState<
    Record<string, "idle" | "verifying" | "verified" | "failed">
  >({});

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.documentProvenance(fundId),
    queryFn: () => getDocumentProvenance(fundId).then((r) => r.data),
  });

  const docs = data ?? [];

  const handleVerify = async (docId: string) => {
    setVerifyState((prev) => ({ ...prev, [docId]: "verifying" }));
    try {
      const result = await verifyDocument(docId);
      setVerifyState((prev) => ({
        ...prev,
        [docId]: result.data.verified ? "verified" : "failed",
      }));
    } catch {
      setVerifyState((prev) => ({ ...prev, [docId]: "failed" }));
    }
  };

  const columns: Column<DocumentProvenance>[] = [
    {
      key: "originalName",
      header: "Original PDF Reference",
      render: (r) => (
        <span className="text-sm font-medium text-foreground">
          {r.originalName}
        </span>
      ),
    },
    {
      key: "hash",
      header: "Integrity",
      render: (r) =>
        r.hash ? (
          <span className="inline-flex items-center gap-1 text-green-600" title={r.hash}>
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs">Hashed</span>
          </span>
        ) : (
          <span className="text-gray-400">--</span>
        ),
    },
    {
      key: "createdAt",
      header: "Ingestion Timestamp",
      render: (r) => (
        <span className="text-muted-foreground">
          {new Date(r.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "anchorTxHash",
      header: "Anchored",
      render: (r) =>
        r.anchorTxHash ? (
          <span className="inline-flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs">Yes</span>
          </span>
        ) : (
          <span className="text-gray-400">Pending</span>
        ),
    },
    {
      key: "verify" as keyof DocumentProvenance,
      header: "Verify",
      render: (r) => {
        const state = verifyState[r.id] ?? "idle";
        if (state === "verifying") {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Verifying...
            </span>
          );
        }
        if (state === "verified") {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <CheckCircle className="h-3.5 w-3.5" />
              Verified
            </span>
          );
        }
        if (state === "failed") {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-red-600">
              <Circle className="h-3.5 w-3.5" />
              Integrity Check Failed
            </span>
          );
        }
        return (
          <button
            onClick={() => handleVerify(r.id)}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Verify
          </button>
        );
      },
    },
  ];

  return (
    <SectionCard title="Document Provenance" className="mb-6">
      {isLoading ? (
        <TableSkeleton rows={4} columns={5} />
      ) : error ? (
        <ErrorAlert
          title="Unable to load document provenance"
          message={`${(error as Error).message}. Try refreshing the page.`}
        />
      ) : docs.length === 0 ? (
        <EmptyState
          title="No documents"
          message="No documents have been uploaded yet."
        />
      ) : (
        <DataTable
          columns={columns}
          data={docs}
          getRowId={(r) => r.id}
        />
      )}
    </SectionCard>
  );
}

// ── Checklist Item ───────────────────────────────────────

function ChecklistItem({
  label,
  available,
}: {
  readonly label: string;
  readonly available: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      {available ? (
        <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
      ) : (
        <Circle className="h-4 w-4 text-gray-300 flex-shrink-0" />
      )}
      <span
        className={`text-sm ${available ? "text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </div>
  );
}

// ── Export Auditor Package Section ────────────────────────

function ExportSection({ fundId }: { readonly fundId: string }) {
  const [exportIds, setExportIds] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: () => createAuditExport(fundId).then((r) => r.data),
    onSuccess: (data) => {
      setExportIds((prev) => [data.auditExportId, ...prev]);
    },
  });

  // Fetch checklist data
  const { data: documents } = useQuery({
    queryKey: QUERY_KEYS.documents(fundId),
    queryFn: () => getDocuments(fundId).then((r) => r.data),
  });

  const { data: capTable } = useQuery({
    queryKey: QUERY_KEYS.capTable(fundId),
    queryFn: () => getCapTable(fundId).then((r) => r.data),
  });

  const { data: capitalAccounts } = useQuery({
    queryKey: QUERY_KEYS.capitalAccounts(fundId),
    queryFn: () => getCapitalAccounts(fundId).then((r) => r.data),
  });

  const { data: settledSubs } = useQuery({
    queryKey: [...QUERY_KEYS.subscriptions(fundId), "SETTLED"],
    queryFn: () => getSubscriptions(fundId, "SETTLED").then((r) => r.data),
  });

  const { data: successTransfers } = useQuery({
    queryKey: QUERY_KEYS.successfulTransfers(fundId),
    queryFn: () => getSuccessfulTransfers(fundId).then((r) => r.data),
  });

  const { data: failedTransfers } = useQuery({
    queryKey: QUERY_KEYS.failedTransfers(fundId),
    queryFn: () => getFailedTransfers(fundId).then((r) => r.data),
  });

  const { data: notices } = useQuery({
    queryKey: QUERY_KEYS.notices(fundId),
    queryFn: () => getNotices(fundId).then((r) => r.data),
  });

  const hasDocuments = (documents ?? []).length > 0;
  const hasCapTable = (capTable?.rows ?? []).length > 0;
  const hasCapitalAccounts = (capitalAccounts ?? []).length > 0;
  const hasSettlements = (settledSubs ?? []).length > 0;
  const hasTransfers =
    (successTransfers ?? []).length > 0 ||
    (failedTransfers ?? []).length > 0;
  const hasNotices = (notices ?? []).length > 0;
  // Check for actual distribution runs by looking for settled subscriptions with capital accounts
  const hasDistributions = hasCapitalAccounts && hasSettlements;
  // Check if any documents have on-chain anchors
  const hasOnChainProofs = (documents ?? []).some(
    (d) => d.hash?.anchoredOnchain === true,
  );

  return (
    <SectionCard title="Export Auditor Package">
      <div className="mb-6">
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none disabled:opacity-50"
        >
          {createMutation.isPending
            ? "Generating..."
            : "Generate Audit Package"}
        </button>
        {createMutation.isError && (
          <div className="mt-3">
            <ErrorAlert
              title="Export generation failed"
              message={`${(createMutation.error as Error).message}. Please try again or contact support.`}
            />
          </div>
        )}
      </div>

      {/* Export table */}
      {exportIds.length > 0 && (
        <div className="mb-6">
          <AuditExportTable exportIds={exportIds} />
        </div>
      )}

      {/* Checklists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            Audit ZIP Checklist
          </h4>
          <div className="space-y-0.5">
            <ChecklistItem
              label="Legal Document Registry"
              available={hasDocuments}
            />
            <ChecklistItem
              label="Ownership Ledger Snapshot"
              available={hasCapTable}
            />
            <ChecklistItem
              label="Capital Account Statements"
              available={hasCapitalAccounts}
            />
            <ChecklistItem
              label="Settlement Evidence Log"
              available={hasSettlements}
            />
            <ChecklistItem label="Transfer Log" available={hasTransfers} />
            <ChecklistItem
              label="Notice Delivery Ledger"
              available={hasNotices}
            />
            <ChecklistItem
              label="Waterfall Calculation Export"
              available={hasDistributions}
            />
            <ChecklistItem
              label="Cryptographic Verification Proofs"
              available={hasOnChainProofs}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            K-1 ZIP Checklist
          </h4>
          <div className="space-y-0.5">
            <ChecklistItem
              label="K-1 Ready Data"
              available={hasSettlements && hasCapitalAccounts}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Audit Export Table ────────────────────────────────────

function DownloadButton({
  exportId,
  status,
}: {
  readonly exportId: string;
  readonly status: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const response = await downloadAuditExport(exportId);
      const { files } = response.data;
      for (const [filename, content] of Object.entries(files)) {
        triggerCsvDownload(filename, content);
      }
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [exportId]);

  if (status !== "READY")
    return <span className="text-xs text-muted-foreground">--</span>;

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
    >
      {downloading ? "Downloading..." : "Download"}
    </button>
  );
}

const exportColumns: Column<AuditExportDetail>[] = [
  {
    key: "auditExportId",
    header: "Export ID",
    className: "font-mono text-xs",
  },
  { key: "exportType", header: "Type" },
  {
    key: "requestedAt",
    header: "Requested At",
    render: (r) => new Date(r.requestedAt).toLocaleString(),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <StatusBadge
        status={
          r.status === "READY"
            ? "Completed"
            : r.status === "BUILDING" || r.status === "QUEUED"
              ? "Processing"
              : r.status
        }
      />
    ),
  },
  {
    key: "artifact" as keyof AuditExportDetail,
    header: "Download",
    render: (r) => (
      <DownloadButton exportId={r.auditExportId} status={r.status} />
    ),
  },
];

function AuditExportTable({
  exportIds,
}: {
  readonly exportIds: string[];
}) {
  const results = useQueries({
    queries: exportIds.map((id) => ({
      queryKey: QUERY_KEYS.auditExport(id),
      queryFn: () => getAuditExport(id).then((r) => r.data),
      refetchInterval: (query: {
        state: { data?: { status?: string } };
      }) => {
        const status = query.state.data?.status;
        return status === "QUEUED" || status === "BUILDING" ? 3000 : false;
      },
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  if (isLoading)
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading exports...
      </div>
    );

  const exports = results
    .map((r) => r.data)
    .filter((d): d is NonNullable<typeof d> => d != null);

  return (
    <DataTable
      columns={exportColumns}
      data={exports}
      getRowId={(r) => r.auditExportId}
    />
  );
}

// ── Main Page ────────────────────────────────────────────

export default function AuditPage() {
  const fundId = DEFAULT_FUND_CODE;

  return (
    <div>
      <PageHeader
        title="Audit & Exports"
        subtitle="Review the event log, verify document provenance, and generate compliance packages"
      />

      <ExportSection fundId={fundId} />
      <EventLogSection fundId={fundId} />
      <DocumentProvenanceSection fundId={fundId} />
    </div>
  );
}
