import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Download, Eye, FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/angainor/PageHeader";
import { DataTable, Column } from "@/components/angainor/DataTable";
import { ErrorAlert } from "@/components/angainor/ErrorAlert";
import { TableSkeleton } from "@/components/angainor/Skeleton";
import { DocumentViewerModal } from "@/components/angainor/DocumentViewerModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import {
  getInvestorDocuments,
  uploadInvestorDocument,
  getInvestorGpReports,
  getInvestorTaxPackagePreview,
  exportInvestorTaxPackage,
  type InvestorDocument,
  type InvestorGpReport,
  type TaxPackagePreview,
} from "@/services/investor-portal.service";
import { getInvestorNotices, type Notice } from "@/services/notices.service";
import { toFriendlyMessage } from "@/lib/errorMessages";

/* ── Document type badge colors ── */

const TYPE_BADGE_STYLES: Record<string, string> = {
  SUBSCRIPTION_AGREEMENT: "bg-muted text-foreground",
  PAYMENT_CONFIRMATION: "bg-green-50 text-green-700",
  WIRE_CONFIRMATION: "bg-green-50 text-green-700",
  CAPITAL_CALL_NOTICE: "bg-amber-50 text-amber-700",
  DISTRIBUTION_NOTICE: "bg-blue-50 text-blue-700",
  CAPITAL_CALL: "bg-amber-50 text-amber-700",
  DISTRIBUTION: "bg-blue-50 text-blue-700",
  TRANSFER: "bg-indigo-50 text-indigo-700",
  GENERAL: "bg-gray-100 text-gray-700",
  TOKEN_MINTED: "bg-green-50 text-green-700",
  QUARTERLY_STATEMENT: "bg-purple-50 text-purple-700",
  MASTER_LPA: "bg-muted text-foreground",
  INVESTOR_UPLOAD: "bg-indigo-50 text-indigo-700",
};

const TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION_AGREEMENT: "Subscription Agreement",
  PAYMENT_CONFIRMATION: "Payment Confirmation",
  WIRE_CONFIRMATION: "Wire Confirmation",
  CAPITAL_CALL_NOTICE: "Capital Call Notice",
  DISTRIBUTION_NOTICE: "Distribution Notice",
  CAPITAL_CALL: "Capital Call Notice",
  DISTRIBUTION: "Distribution Notice",
  TRANSFER: "Transfer Notice",
  GENERAL: "General Notice",
  TOKEN_MINTED: "Token Minted Notice",
  QUARTERLY_STATEMENT: "Quarterly Statement",
  MASTER_LPA: "Master LPA",
  INVESTOR_UPLOAD: "Your upload",
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

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);

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

function EmptyDocuments({ message }: { readonly message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.5} />
      <p className="text-sm font-medium text-muted-foreground">
        {message ?? "No documents available yet"}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Your documents will appear here once they are generated.
      </p>
    </div>
  );
}

/* ── Shared row action buttons ── */

function RowActions({
  doc,
  onView,
}: {
  readonly doc: InvestorDocument;
  readonly onView: (doc: InvestorDocument) => void;
}) {
  const { downloadable } = doc;
  return (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (downloadable) onView(doc);
        }}
        disabled={!downloadable}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          downloadable
            ? "text-indigo-600 hover:bg-indigo-50"
            : "text-gray-400 cursor-not-allowed"
        }`}
        title={downloadable ? `View ${doc.name}` : "Preview unavailable"}
      >
        <Eye className="h-3.5 w-3.5" />
        View
      </button>
    </div>
  );
}

/* ── Column definitions ── */

const LEGAL_TYPES = new Set([
  "SUBSCRIPTION_AGREEMENT",
  "PAYMENT_CONFIRMATION",
  "WIRE_CONFIRMATION",
  "MASTER_LPA",
  "INVESTOR_UPLOAD",
]);
const NOTICE_TYPES = new Set([
  "CAPITAL_CALL_NOTICE",
  "DISTRIBUTION_NOTICE",
  "CAPITAL_CALL",
  "DISTRIBUTION",
  "TRANSFER",
  "GENERAL",
  "TOKEN_MINTED",
]);

const buildLegalColumns = (
  onView: (doc: InvestorDocument) => void,
): Column<InvestorDocument>[] => [
  {
    key: "name",
    header: "Document Name",
    render: (row) => (
      <span className="text-sm font-medium text-foreground">{row.name}</span>
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
      <span className="text-sm text-muted-foreground">{fmtDate(row.createdAt)}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadgeDoc status={row.status} />,
  },
  {
    key: "actions",
    header: "Actions",
    render: (row) => <RowActions doc={row} onView={onView} />,
  },
];

const buildNoticeColumns = (
  onView: (doc: InvestorDocument) => void,
): Column<InvestorDocument>[] => [
  {
    key: "name",
    header: "Document Name",
    render: (row) => {
      const meta = (row as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
      return (
        <div>
          <span className="text-sm font-medium text-foreground">{row.name}</span>
          {row.type === "CAPITAL_CALL_NOTICE" && meta && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {meta.amountDue != null && <span>Amount Due: {fmtCurrency(Number(meta.amountDue))}</span>}
              {meta.amountDue != null && meta.dueDate != null && <span className="mx-1">&middot;</span>}
              {meta.dueDate != null && <span>Due: {fmtDate(String(meta.dueDate))}</span>}
            </div>
          )}
          {row.type === "DISTRIBUTION_NOTICE" && meta && meta.payoutAmount != null && (
            <div className="text-xs text-muted-foreground mt-0.5">
              Payout: {fmtCurrency(Number(meta.payoutAmount))}
            </div>
          )}
        </div>
      );
    },
  },
  {
    key: "type",
    header: "Type",
    render: (row) => <TypeBadge type={row.type} />,
  },
  {
    key: "createdAt",
    header: "Date Sent",
    render: (row) => (
      <span className="text-sm text-muted-foreground">{fmtDate(row.createdAt)}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadgeDoc status={row.status} />,
  },
  {
    key: "actions",
    header: "Actions",
    render: (row) => <RowActions doc={row} onView={onView} />,
  },
];

/* ── GP Reports ── */

const buildGpReportColumns = (
  onView: (report: InvestorGpReport) => void,
): Column<InvestorGpReport>[] => [
  {
    key: "title",
    header: "Document Name",
    render: (row) => (
      <span className="text-sm font-medium text-foreground">{row.title}</span>
    ),
  },
  {
    key: "period",
    header: "Period",
    render: (row) => (
      <span className="inline-flex items-center rounded-full bg-purple-50 text-purple-700 px-2.5 py-0.5 text-xs font-medium">
        {row.period ?? "—"}
      </span>
    ),
  },
  {
    key: "uploadedAt",
    header: "Date Uploaded",
    render: (row) => (
      <span className="text-sm text-muted-foreground">{fmtDate(row.uploadedAt)}</span>
    ),
  },
  {
    key: "download",
    header: "View",
    render: (row) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onView(row);
        }}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors text-indigo-600 hover:bg-indigo-50"
      >
        <Eye className="h-3.5 w-3.5" />
        View
      </button>
    ),
  },
];

/* ── Upload Tab ── */

function UploadTab({
  onUpload,
  isUploading,
}: {
  readonly onUpload: (files: FileList) => void;
  readonly isUploading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAreaClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files);
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onUpload(files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div className="py-8">
      <div
        onClick={handleAreaClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-border rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
        aria-busy={isUploading}
      >
        <Upload className="h-10 w-10 text-muted-foreground mb-4" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground mb-1">
          {isUploading ? "Uploading…" : "Drag files here or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground">
          Accepted file types: PDF, DOCX
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

/* ── Main Page Component ── */

export default function InvestorDocuments() {
  const fundId = DEFAULT_FUND_CODE;
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "legal";
  const [viewerDoc, setViewerDoc] = useState<{
    contentPath: string;
    filename: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const { data: documents, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorDocuments(fundId),
    queryFn: () => getInvestorDocuments(fundId).then((r) => r.data),
  });

  const { data: gpReports } = useQuery({
    queryKey: QUERY_KEYS.investorGpReports(fundId),
    queryFn: () => getInvestorGpReports(fundId).then((r) => r.data),
  });

  const { data: notices } = useQuery({
    queryKey: QUERY_KEYS.investorNotices(),
    queryFn: () => getInvestorNotices().then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadInvestorDocument(file, fundId).then((r) => r.data),
    onSuccess: (result) => {
      toast.success(`Uploaded ${result.fileName}`);
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.investorDocuments(fundId),
      });
    },
    onError: (err) => {
      toast.error(toFriendlyMessage(err));
    },
  });

  const handleUploadFiles = (files: FileList) => {
    Array.from(files).forEach((file) => uploadMutation.mutate(file));
  };

  const handleViewDocument = (doc: InvestorDocument) => {
    if (NOTICE_TYPES.has(doc.type)) {
      setViewerDoc({
        contentPath: `/investor/me/notices/${doc.id}/pdf`,
        filename: `${doc.name}.pdf`,
      });
      return;
    }
    setViewerDoc({
      contentPath: `/investor/me/documents/${doc.id}/content?fundId=${encodeURIComponent(fundId)}`,
      filename: doc.name,
    });
  };

  const handleViewGpReport = (report: InvestorGpReport) => {
    setViewerDoc({
      contentPath: `/investor/me/documents/${report.documentId}/content?fundId=${encodeURIComponent(fundId)}`,
      filename: report.fileName,
    });
  };

  const gpReportColumns = buildGpReportColumns(handleViewGpReport);

  const legalColumns = buildLegalColumns(handleViewDocument);
  const noticeColumns = buildNoticeColumns(handleViewDocument);

  const [isTaxPreviewOpen, setIsTaxPreviewOpen] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [taxPreview, setTaxPreview] = useState<TaxPackagePreview | null>(null);
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const taxYear = new Date().getFullYear();

  // Close preview on Escape and restore focus to the Preview button on close.
  useEffect(() => {
    if (!isTaxPreviewOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsTaxPreviewOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const target = previouslyFocusedRef.current ?? previewButtonRef.current;
      target?.focus?.();
    };
  }, [isTaxPreviewOpen]);

  const handlePreviewTaxPackage = async () => {
    setIsGeneratingPreview(true);
    try {
      const res = await getInvestorTaxPackagePreview(taxYear, fundId);
      setTaxPreview(res.data);
      setIsTaxPreviewOpen(true);
    } catch (err) {
      toast.error(toFriendlyMessage(err));
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleDownloadTaxPackage = async (format: 'csv' | 'pdf' = 'pdf') => {
    try {
      await exportInvestorTaxPackage(taxYear, format, fundId);
    } catch (err) {
      toast.error(toFriendlyMessage(err));
    }
  };

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
  if (error)
    return (
      <ErrorAlert
        title="Failed to load documents"
        message={(error as Error).message}
      />
    );

  const docs = documents ?? [];
  const mappedNotices: InvestorDocument[] = (notices ?? []).map((notice: Notice) => ({
    id: notice.id,
    name: TYPE_LABELS[notice.type] ?? notice.type.replace(/_/g, " "),
    type: notice.type,
    createdAt: notice.generatedAt,
    status: notice.deliveries[0]?.status ?? "GENERATED",
    downloadable: true,
    metadata: {
      anchorTxHash: notice.anchorTxHash,
      distributionRunId: notice.distributionRunId,
      capitalCallId: notice.capitalCallId,
    },
  }));
  const mergedDocs = [...docs, ...mappedNotices].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const legalDocs = mergedDocs.filter((d) => LEGAL_TYPES.has(d.type));
  const noticeDocs = mergedDocs.filter((d) => NOTICE_TYPES.has(d.type));

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Your legal document vault"
        action={
          <div className="flex items-center gap-2">
            <button
              ref={previewButtonRef}
              onClick={handlePreviewTaxPackage}
              disabled={isGeneratingPreview}
              aria-busy={isGeneratingPreview}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Eye className="h-4 w-4" />
              {isGeneratingPreview ? "Generating preview…" : "Preview Tax Package"}
            </button>
            <button
              onClick={() => handleDownloadTaxPackage('pdf')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </button>
            <button
              onClick={() => handleDownloadTaxPackage('csv')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <span className="sr-only" aria-live="polite">
              {isGeneratingPreview ? "Generating preview…" : ""}
            </span>
          </div>
        }
      />

      {isTaxPreviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tax-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4"
          onClick={() => setIsTaxPreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 id="tax-preview-title" className="text-base font-semibold text-gray-900">
                  Tax Package Preview
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Aggregated K-1, capital account statement, and distribution summary
                </p>
              </div>
              <button
                onClick={() => setIsTaxPreviewOpen(false)}
                aria-label="Close preview"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-6">
              {taxPreview && !taxPreview.available && (
                <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
                  <p className="font-medium text-gray-900 mb-1">
                    No tax data for {taxPreview.taxYear}
                  </p>
                  <p className="text-xs text-gray-600">
                    {taxPreview.reason ?? "A tax report has not been generated for this year yet."}
                  </p>
                </div>
              )}
              {taxPreview?.available && taxPreview.report && (
                <div className="space-y-4">
                  {taxPreview.report.source === "DERIVED_LEDGER_PREVIEW" && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      This is a provisional preview derived from your current ledger activity for {taxPreview.report.taxYear}. A finalized tax report has not been generated yet.
                    </div>
                  )}
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <div className="flex justify-between border-b border-gray-100 py-2">
                      <dt className="text-gray-500">Tax Year</dt>
                      <dd className="font-medium text-gray-900">{taxPreview.report.taxYear}</dd>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 py-2">
                      <dt className="text-gray-500">Entity</dt>
                      <dd className="font-medium text-gray-900">{taxPreview.report.taxEntityName ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 py-2">
                      <dt className="text-gray-500">Ordinary Income</dt>
                      <dd className="font-mono text-gray-900">{taxPreview.report.ordinaryIncome}</dd>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 py-2">
                      <dt className="text-gray-500">Return of Capital</dt>
                      <dd className="font-mono text-gray-900">{taxPreview.report.returnOfCapital}</dd>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 py-2">
                      <dt className="text-gray-500">Long-Term Capital Gains</dt>
                      <dd className="font-mono text-gray-900">{taxPreview.report.ltcg}</dd>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 py-2">
                      <dt className="text-gray-500">Short-Term Capital Gains</dt>
                      <dd className="font-mono text-gray-900">{taxPreview.report.stcg}</dd>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 py-2 sm:col-span-2">
                      <dt className="text-gray-500">Total Distributions</dt>
                      <dd className="font-mono text-gray-900">{taxPreview.report.totalDistributions}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setIsTaxPreviewOpen(false)}
                className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => handleDownloadTaxPackage('pdf')}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="legal">Legal Documents</TabsTrigger>
          <TabsTrigger value="notices">GP Notices</TabsTrigger>
          <TabsTrigger value="gp-reports">GP Reports</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>

        {/* Tab 1: Legal Documents */}
        <TabsContent value="legal">
          {legalDocs.length === 0 ? (
            <EmptyDocuments message="No legal documents available yet" />
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <DataTable
                columns={legalColumns}
                data={legalDocs}
                getRowId={(r) => r.id}
                emptyMessage="No legal documents available"
              />
            </div>
          )}
        </TabsContent>

        {/* Tab 2: GP Notices */}
        <TabsContent value="notices">
          {noticeDocs.length === 0 ? (
            <EmptyDocuments message="No GP notices available yet" />
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <DataTable
                columns={noticeColumns}
                data={noticeDocs}
                getRowId={(r) => r.id}
                emptyMessage="No GP notices available"
              />
            </div>
          )}
        </TabsContent>

        {/* Tab 3: GP Reports */}
        <TabsContent value="gp-reports">
          {!gpReports || gpReports.length === 0 ? (
            <EmptyDocuments message="No GP reports available yet" />
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <DataTable
                columns={gpReportColumns}
                data={gpReports}
                getRowId={(r) => r.documentId}
                emptyMessage="No GP reports available"
              />
            </div>
          )}
        </TabsContent>

        {/* Tab 4: Upload */}
        <TabsContent value="upload">
          <UploadTab onUpload={handleUploadFiles} isUploading={uploadMutation.isPending} />
        </TabsContent>
      </Tabs>

      {viewerDoc && (
        <DocumentViewerModal
          open={viewerDoc !== null}
          onOpenChange={(open) => {
            if (!open) setViewerDoc(null);
          }}
          contentPath={viewerDoc.contentPath}
          filename={viewerDoc.filename}
        />
      )}
    </div>
  );
}
