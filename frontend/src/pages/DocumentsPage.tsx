import { useState, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { isWorkspaceDocument } from "@/lib/document-workspace";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_FUND_CODE, QUERY_KEYS, DEMO_MODE } from "@/config/constants";
import {
  uploadMasterLpa,
  getParseStatus,
  getDocumentHashes,
  getDocuments,
  getExtractedFields,
  approveDocument,
  updateExtractedFields,
  getInvestors,
} from "@/services";
import {
  uploadGoverningDocument,
  GOVERNING_DOCUMENT_TYPE_OPTIONS,
  type GoverningDocumentType,
} from "@/services/documents.service";
import {
  getNotices,
  createNotice,
  updateNoticeDelivery,
  anchorPendingDocuments,
  getNoticeTemplate,
} from "@/services/notices.service";
import { NoticeBodyEditor } from "@/components/angainor/NoticeBodyEditor";
import { getCapitalCalls } from "@/services/capital-calls.service";
import { getFund, updateFund } from "@/services/fund.service";
import { getFundAllocation } from "@/services/subscriptions.service";
import { toFriendlyMessage } from "@/lib/errorMessages";
import { toast } from "sonner";
import type {
  UploadResult,
  ParseStatus,
  DocumentHash,
  FundDocument,
  ExtractedField,
  FieldUpdate,
  SubscriptionItem,
  ReportingDocument,
} from "@/services/documents.service";
import {
  getAdminReportingDocuments,
  uploadReportingDocument,
} from "@/services/documents.service";
import type { Investor } from "@/services/investors.service";
import type { Notice } from "@/services/notices.service";
import { PageHeader } from "@/components/angainor/PageHeader";
import { SectionCard } from "@/components/angainor/SectionCard";
import { DataTable, Column } from "@/components/angainor/DataTable";
import { StatusBadge } from "@/components/angainor/StatusBadge";
import { ErrorAlert } from "@/components/angainor/ErrorAlert";
import { EmptyState } from "@/components/angainor/EmptyState";
import { ExplorerLink } from "@/components/angainor/ExplorerLink";
import { HashDisplay } from "@/components/angainor/HashDisplay";
import { MetricCard } from "@/components/angainor/MetricCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  Hash,
  AlertTriangle,
  Eye,
  Save,
  StickyNote,
  Plus,
  X,
  Search,
  Copy,
  Bell,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { TechnicalDetails } from "@/components/angainor/TechnicalDetails";
import { DocumentViewerModal } from "@/components/angainor/DocumentViewerModal";

// ── Helpers ──────────────────────────────────────────────────

function mapParseStatus(status: string): string {
  const map: Record<string, string> = {
    QUEUED: "Pending",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    FAILED: "Failed",
  };
  return map[status] ?? status;
}

function mapHashStatus(status: string): string {
  const map: Record<string, string> = {
    QUEUED: "Pending",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    ANCHORED: "Completed",
    FAILED: "Failed",
  };
  return map[status] ?? status;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

function truncateHash(hash: string, len = 10): string {
  if (!hash || hash.length <= len * 2) return hash;
  return `${hash.slice(0, len)}...${hash.slice(-6)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Inline expandable badge for on-chain anchor ─────────────

function AnchoredBadgeWithTx({ txHash }: { readonly txHash: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="inline-flex flex-col">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((prev) => !prev);
        }}
        className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
      >
        <CheckCircle2 className="h-3 w-3" />
        Anchored
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="mt-1" onClick={(e) => e.stopPropagation()}>
          <ExplorerLink value={txHash} type="tx" />
        </div>
      )}
    </div>
  );
}

// ── Table columns ────────────────────────────────────────────

/** Get display value from an extracted field (text takes priority, then numeric) */
function fieldDisplayValue(f: ExtractedField): string {
  if (f.fieldValueText) return f.fieldValueText;
  if (f.fieldValueNumeric != null) return String(f.fieldValueNumeric);
  return "";
}

/**
 * Friendly labels for the governing-document types stored on Document.documentType.
 * Keep in sync with backend DocumentType enum.
 */
const GOVERNING_TYPE_LABELS: Record<string, string> = {
  MASTER_LPA: "Master LPA",
  LPA_AMENDMENT: "LPA Amendment",
  SIDE_LETTER: "Side Letter",
  JOINDER: "Joinder",
  ASSIGNMENT_AND_ASSUMPTION: "Assignment & Assumption",
  SUBSCRIPTION_AGREEMENT: "Subscription Agreement",
  WIRE_CONFIRMATION: "Wire Confirmation",
  GP_REPORT: "GP Report",
  INVESTOR_UPLOAD: "Investor Upload",
};

function friendlyDocumentType(type: string | null | undefined): string {
  if (!type) return "Master LPA";
  return GOVERNING_TYPE_LABELS[type] ?? type;
}

// ── Notice status badge colors ──────────────────────────────

function noticeStatusBadge(status: string) {
  const colorMap: Record<string, string> = {
    GENERATED: "bg-gray-100 text-gray-600",
    ANCHORED: "bg-blue-50 text-blue-700",
    SENT: "bg-blue-50 text-blue-700",
    VIEWED: "bg-green-50 text-green-700",
  };
  const classes =
    colorMap[status.toUpperCase()] ?? "bg-gray-100 text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {status}
    </span>
  );
}

// ── Subscription draft row for the modal ─────────────────────

interface SubscriptionDraft {
  investorId: string;
  investorName: string;
  walletId: string;
  walletAddress: string;
  allocationPct: number;
  committedAmount: number;
}

// ── Notice table with filter ──────────────────────────────────

interface NoticeRow {
  id: string;
  deliveryId: string | null;
  type: string;
  recipientName: string;
  generatedAt: string;
  documentHash: string;
  anchorTxHash: string;
  sentAt: string;
  openedAt: string;
  downloadedAt: string;
  status: string;
}

function NoticeTableWithFilter({
  noticeRows,
  noticeColumns,
}: {
  readonly noticeRows: NoticeRow[];
  readonly noticeColumns: Column<NoticeRow>[];
}) {
  const [showUnopenedOnly, setShowUnopenedOnly] = useState(false);

  const unopenedCount = noticeRows.filter((r) => !r.openedAt).length;
  const displayRows = showUnopenedOnly
    ? noticeRows.filter((r) => !r.openedAt)
    : noticeRows;

  return (
    <>
      {unopenedCount > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowUnopenedOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              showUnopenedOnly
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : "bg-gray-100 text-gray-600 border border-border hover:bg-gray-200"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            {showUnopenedOnly
              ? `Showing ${unopenedCount} unopened`
              : `${unopenedCount} unopened`}
          </button>
          {showUnopenedOnly && (
            <button
              onClick={() => setShowUnopenedOnly(false)}
              className="text-xs text-muted-foreground hover:text-gray-700 underline"
            >
              Show all
            </button>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <DataTable
          columns={noticeColumns}
          data={displayRows}
          getRowId={(r) => r.id}
        />
      </div>
    </>
  );
}

// ── Reporting Section ────────────────────────────────────────

function ReportingSection({
  fundId,
  onView,
}: {
  readonly fundId: string;
  readonly onView: (doc: ReportingDocument) => void;
}) {
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: reports, isLoading } = useQuery({
    queryKey: QUERY_KEYS.adminReportingDocs(fundId),
    queryFn: () => getAdminReportingDocuments(fundId).then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: (args: { f: File; t: string; p: string }) =>
      uploadReportingDocument(fundId, args.f, args.t, args.p),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.adminReportingDocs(fundId),
      });
      toast.success("Reporting document uploaded");
      setIsUploadOpen(false);
      setTitle("");
      setPeriod("");
      setFile(null);
    },
    onError: (err) => toast.error(toFriendlyMessage(err)),
  });

  const handleSubmit = () => {
    if (!file || !title.trim() || !period.trim()) {
      toast.error("Title, period, and a file are required");
      return;
    }
    uploadMutation.mutate({ f: file, t: title.trim(), p: period.trim() });
  };

  const rows = reports ?? [];

  return (
    <>
      <SectionCard
        title="LP Reporting Packages"
        action={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setIsUploadOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Upload Report
          </Button>
        }
      >
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading reports…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No reporting packages"
            message="LP reporting packages will appear here once uploaded."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Document Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Period
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Upload Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Uploaded By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    View
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((report) => (
                  <tr
                    key={report.documentId}
                    className="border-b border-border"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {report.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {report.period ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(report.uploadedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {report.uploadedBy ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onView(report)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-muted transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Reporting Document</DialogTitle>
            <DialogDescription>
              Add a new LP reporting package. It will be visible to all
              investors with a subscription in this fund.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="report-title"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Title
              </label>
              <input
                id="report-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q1 2027 Quarterly LP Report"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="report-period"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Period
              </label>
              <input
                id="report-period"
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Q1 2027"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="report-file"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                File
              </label>
              <input
                id="report-file"
                type="file"
                accept=".pdf,.docx,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUploadOpen(false)}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main component ──────────────────────────────────────────

export default function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = ["governing", "notices", "reporting", "upload"].includes(
    requestedTab ?? "",
  )
    ? requestedTab!
    : "governing";
  const [documentSearch, setDocumentSearch] = useState("");
  const fundId = DEFAULT_FUND_CODE;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<
    SubscriptionDraft[]
  >([]);
  // Fund-wide total commitment used to derive each LP's allocation %.
  const [fundTotalCommitment, setFundTotalCommitment] = useState<number>(0);
  const [approveSuccess, setApproveSuccess] = useState<number | null>(null);
  const [fieldEdits, setFieldEdits] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [uploadDocType, setUploadDocType] =
    useState<GoverningDocumentType>("MASTER_LPA");
  const [uploadParentId, setUploadParentId] = useState<string>("");
  const [uploadEffectiveDate, setUploadEffectiveDate] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<{
    id: string;
    filename: string;
  } | null>(null);
  const [showGenerateNoticeModal, setShowGenerateNoticeModal] = useState(false);
  const [noticeForm, setNoticeForm] = useState<{
    type: "CAPITAL_CALL" | "DISTRIBUTION" | "TRANSFER" | "GENERAL";
    recipientInvestorId: string;
    capitalCallId: string;
    distributionRunId: string;
    subject: string;
    body: string;
    templateKey: string;
  }>({
    type: "GENERAL",
    recipientInvestorId: "",
    capitalCallId: "",
    distributionRunId: "",
    subject: "",
    body: "",
    templateKey: "",
  });
  const [bodyTouched, setBodyTouched] = useState(false);
  const [availableTokens, setAvailableTokens] = useState<readonly string[]>([]);

  // ── Queries ────────────────────────────────────────────────

  const {
    data: documents,
    isLoading: docsLoading,
    error: docsError,
  } = useQuery({
    queryKey: QUERY_KEYS.documents(fundId),
    queryFn: () => getDocuments(fundId).then((r) => r.data),
  });

  const { data: notices, isLoading: noticesLoading } = useQuery({
    queryKey: QUERY_KEYS.notices(fundId),
    queryFn: () => getNotices(fundId).then((r) => r.data),
  });

  const { data: parseStatusData } = useQuery({
    queryKey: QUERY_KEYS.documentParseStatus(selectedDocId ?? ""),
    queryFn: () => getParseStatus(selectedDocId!).then((r) => r.data),
    enabled: !!selectedDocId,
    refetchInterval: (query) => {
      const status = query.state.data?.parseStatus;
      return status === "QUEUED" || status === "PROCESSING" ? 3000 : false;
    },
  });

  const { data: hashesData } = useQuery({
    queryKey: QUERY_KEYS.documentHashes(selectedDocId ?? ""),
    queryFn: () => getDocumentHashes(selectedDocId!).then((r) => r.data),
    enabled: !!selectedDocId,
  });

  const { data: extractedFieldsData } = useQuery({
    queryKey: QUERY_KEYS.extractedFields(selectedDocId ?? ""),
    queryFn: () => getExtractedFields(selectedDocId!).then((r) => r.data),
    enabled: !!selectedDocId && parseStatusData?.parseStatus === "COMPLETED",
  });

  const { data: investors } = useQuery({
    queryKey: QUERY_KEYS.investors(fundId),
    queryFn: () => getInvestors(fundId).then((r) => r.data),
  });

  const { data: capitalCalls } = useQuery({
    queryKey: QUERY_KEYS.capitalCalls(fundId),
    queryFn: () => getCapitalCalls(fundId).then((r) => r.data),
  });

  const { data: fundData } = useQuery({
    queryKey: ["fund", fundId, "details"],
    queryFn: () => getFund(fundId).then((r) => r.data),
  });

  // Fund allocation headroom: drives "already fully allocated" filtering when
  // creating subscriptions from an LPA amendment (top-up flow).
  const { data: fundAllocation } = useQuery({
    queryKey: ["fund-allocation", fundId],
    queryFn: () => getFundAllocation(fundId).then((r) => r.data),
  });

  // Fetch the default template body whenever the type/recipient/related entity
  // changes; only auto-fill the editor when the admin hasn't started typing.
  const { data: noticeTemplate } = useQuery({
    queryKey: [
      "notice-template",
      fundId,
      noticeForm.type,
      noticeForm.recipientInvestorId,
      noticeForm.capitalCallId,
      noticeForm.distributionRunId,
    ],
    queryFn: () =>
      getNoticeTemplate({
        type: noticeForm.type,
        fundId,
        recipientInvestorId: noticeForm.recipientInvestorId || undefined,
        capitalCallId: noticeForm.capitalCallId || undefined,
        distributionRunId: noticeForm.distributionRunId || undefined,
      }).then((r) => r.data),
    enabled: showGenerateNoticeModal,
  });

  // Sync template into the form unless the admin has edited the body manually.
  useEffect(() => {
    if (!noticeTemplate || bodyTouched) return;
    setNoticeForm((prev) => ({
      ...prev,
      subject: noticeTemplate.subject,
      body: noticeTemplate.body,
      templateKey: noticeTemplate.templateKey,
    }));
    setAvailableTokens(noticeTemplate.availableTokens);
  }, [noticeTemplate, bodyTouched]);

  const extractedFields = extractedFieldsData ?? [];

  // ── Mutations ──────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      if (uploadDocType === "MASTER_LPA") {
        return uploadMasterLpa(fundId, file).then((r) => r.data);
      }
      // Amendment / side-letter / joinder path: requires parent.
      return uploadGoverningDocument({
        fundId,
        file,
        documentType: uploadDocType,
        parentDocumentId: uploadParentId || undefined,
        effectiveDate: uploadEffectiveDate || undefined,
      }).then((r) => ({
        documentId: r.data.documentId,
        parseStatus: r.data.parseStatus,
        hashStatus: r.data.hashStatus,
      }));
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documents(fundId),
      });
      setSelectedDocId(_data.documentId);
      setUploadError(null);
      // Reset amendment form state on success so a follow-up upload starts clean.
      setUploadParentId("");
      setUploadEffectiveDate("");
    },
    onError: (err: unknown) => {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    },
  });

  const saveFieldsMutation = useMutation({
    mutationFn: (fieldUpdates: FieldUpdate[]) =>
      updateExtractedFields(selectedDocId!, fieldUpdates).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.extractedFields(selectedDocId ?? ""),
      });
      setFieldEdits({});
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({
      items,
      approveNotes,
      approveFieldUpdates,
    }: {
      items: SubscriptionItem[];
      approveNotes?: string;
      approveFieldUpdates?: FieldUpdate[];
    }) =>
      approveDocument(selectedDocId!, fundId, items, {
        notes: approveNotes,
        fieldUpdates: approveFieldUpdates,
      }).then((r) => r.data),
    onSuccess: (data) => {
      setApproveSuccess(data.subscriptionsCreated);
      setShowApproveModal(false);
      setFieldEdits({});
      setNotes("");
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documents(fundId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.subscriptions(fundId),
      });
      queryClient.invalidateQueries({
        queryKey: ["fund-allocation", fundId],
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.extractedFields(selectedDocId ?? ""),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documentHashes(selectedDocId ?? ""),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documentParseStatus(selectedDocId ?? ""),
      });
    },
  });

  const createNoticeMutation = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof createNotice>[0] = {
        fundId,
        type: noticeForm.type,
        recipientInvestorId: noticeForm.recipientInvestorId,
        subject: noticeForm.subject || undefined,
        bodyMarkdown: noticeForm.body || undefined,
        templateKey: noticeForm.templateKey || undefined,
      };
      if (noticeForm.type === "CAPITAL_CALL" && noticeForm.capitalCallId) {
        body.capitalCallId = noticeForm.capitalCallId;
      }
      if (noticeForm.type === "DISTRIBUTION" && noticeForm.distributionRunId) {
        body.distributionRunId = noticeForm.distributionRunId;
      }
      return createNotice(body).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success("Notice generated");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notices(fundId) });
      setShowGenerateNoticeModal(false);
      setNoticeForm({
        type: "GENERAL",
        recipientInvestorId: "",
        capitalCallId: "",
        distributionRunId: "",
        subject: "",
        body: "",
        templateKey: "",
      });
      setBodyTouched(false);
    },
    onError: (err: unknown) => {
      toast.error(toFriendlyMessage(err));
    },
  });

  const updateDeliveryMutation = useMutation({
    mutationFn: ({
      noticeId,
      deliveryId,
      status,
    }: {
      noticeId: string;
      deliveryId: string;
      status: string;
    }) =>
      updateNoticeDelivery(noticeId, deliveryId, status).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notices(fundId) });
    },
    onError: (err: unknown) => {
      toast.error(toFriendlyMessage(err));
    },
  });

  const anchorPendingMutation = useMutation({
    mutationFn: () => anchorPendingDocuments().then((r) => r.data),
    onSuccess: (result) => {
      const count =
        (result as { anchoredCount?: number } | null)?.anchoredCount ?? 0;
      toast.success(
        count > 0
          ? `Anchored ${count} document${count === 1 ? "" : "s"}`
          : "No pending documents to anchor",
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents(fundId) });
    },
    onError: (err: unknown) => {
      toast.error(toFriendlyMessage(err));
    },
  });

  // ── File handling ──────────────────────────────────────────

  const selectedTypeRequiresParent =
    GOVERNING_DOCUMENT_TYPE_OPTIONS.find((o) => o.value === uploadDocType)
      ?.requiresParent ?? false;

  const handleFileSelect = useCallback(
    (file: File) => {
      if (file.type !== "application/pdf") {
        setUploadError("Only PDF files are accepted.");
        return;
      }
      if (selectedTypeRequiresParent && !uploadParentId) {
        setUploadError(
          "Pick the Master LPA this document amends before uploading.",
        );
        return;
      }
      setUploadError(null);
      uploadMutation.mutate(file);
    },
    [uploadMutation, selectedTypeRequiresParent, uploadParentId],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // ── Prepare subscription drafts ────────────────────────────

  const [investorSearch, setInvestorSearch] = useState("");
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  const getTotalCommitment = () => {
    // Fund's documented total commitment takes priority. Fall back to the
    // extracted LPA field, then a sane default for an unconfigured demo fund.
    const fromFund = parseFloat(fundData?.targetCommitment ?? "");
    if (Number.isFinite(fromFund) && fromFund > 0) return fromFund;
    const fieldMap = new Map(
      extractedFields.map((f) => [
        f.fieldName.toLowerCase(),
        fieldDisplayValue(f),
      ]),
    );
    return parseFloat(fieldMap.get("total_commitment") ?? "0") || 10000000;
  };

  // Derive allocation % from a committed amount against the fund total.
  const deriveAllocationPct = (amount: number, fundTotal: number): number => {
    if (!Number.isFinite(fundTotal) || fundTotal <= 0) return 0;
    return parseFloat(((amount / fundTotal) * 100).toFixed(4));
  };

  const openApproveModal = () => {
    if (!investors || investors.length === 0) return;

    const eligible = investors.filter(
      (inv) =>
        inv.fundEligibility?.status === "APPROVED" ||
        inv.fundEligibility?.status === "ELIGIBLE",
    );
    if (eligible.length === 0) return;

    const totalCommitment = getTotalCommitment();
    const commitPerLp = totalCommitment / eligible.length;

    const drafts: SubscriptionDraft[] = eligible.map((inv) => {
      const primaryWallet =
        inv.wallets.find((w) => w.isPrimary) ?? inv.wallets[0];
      // Amendments are top-ups: start at zero so the admin enters new capital.
      const amount = isAmendment ? 0 : commitPerLp;
      return {
        investorId: inv.investorId,
        investorName: inv.legalName,
        walletId: primaryWallet?.walletId ?? "",
        walletAddress: primaryWallet?.address ?? "No wallet",
        allocationPct: deriveAllocationPct(amount, totalCommitment),
        committedAmount: amount,
      };
    });

    // Amendment: the modal's denominator is the existing fund size; the new
    // capital entered below expands it and the cap table re-normalizes.
    setFundTotalCommitment(
      isAmendment
        ? (fundAllocation?.totalCommitted ?? totalCommitment)
        : totalCommitment,
    );
    setSubscriptionDrafts(drafts);
    setShowApproveModal(true);
    setApproveSuccess(null);
    setInvestorSearch("");
    setShowAddDropdown(false);
  };

  const addInvestorToDrafts = (inv: Investor) => {
    const primaryWallet =
      inv.wallets.find((w) => w.isPrimary) ?? inv.wallets[0];
    const newDraft: SubscriptionDraft = {
      investorId: inv.investorId,
      investorName: inv.legalName,
      walletId: primaryWallet?.walletId ?? "",
      walletAddress: primaryWallet?.address ?? "No wallet",
      allocationPct: 0,
      committedAmount: 0,
    };
    setSubscriptionDrafts((prev) => [...prev, newDraft]);
    setInvestorSearch("");
    setShowAddDropdown(false);
  };

  const removeInvestorFromDrafts = (investorId: string) => {
    setSubscriptionDrafts((prev) =>
      prev.filter((d) => d.investorId !== investorId),
    );
  };

  const redistributeEqually = () => {
    if (subscriptionDrafts.length === 0) return;
    const commitPerLp = fundTotalCommitment / subscriptionDrafts.length;
    setSubscriptionDrafts((prev) =>
      prev.map((d) => ({
        ...d,
        committedAmount: commitPerLp,
        allocationPct: deriveAllocationPct(commitPerLp, fundTotalCommitment),
      })),
    );
  };

  // Only the committed amount is editable per row; allocation % is derived.
  const updateDraftAmount = (index: number, value: number) => {
    setSubscriptionDrafts((prev) =>
      prev.map((d, i) =>
        i === index
          ? {
              ...d,
              committedAmount: value,
              allocationPct: deriveAllocationPct(value, fundTotalCommitment),
            }
          : d,
      ),
    );
  };

  // When the fund total changes, every derived allocation % must be recomputed.
  const updateFundTotal = (value: number) => {
    setFundTotalCommitment(value);
    setSubscriptionDrafts((prev) =>
      prev.map((d) => ({
        ...d,
        allocationPct: deriveAllocationPct(d.committedAmount, value),
      })),
    );
  };

  const handleSaveFields = () => {
    const updates: FieldUpdate[] = Object.entries(fieldEdits).map(
      ([fieldId, value]) => ({ fieldId, fieldValueText: value }),
    );
    if (updates.length > 0) saveFieldsMutation.mutate(updates);
  };

  const handleApprove = async () => {
    const items: SubscriptionItem[] = subscriptionDrafts.map((d) => ({
      investorId: d.investorId,
      walletId: d.walletId,
      // Amendments: % is re-normalized server-side against the expanded fund;
      // send the post-amendment estimate so the request is internally valid.
      allocationPct: isAmendment
        ? amendmentFundTotal > 0
          ? parseFloat(
              ((d.committedAmount / amendmentFundTotal) * 100).toFixed(4),
            )
          : 0
        : d.allocationPct,
      committedAmount: d.committedAmount,
    }));
    const approveFieldUpdates: FieldUpdate[] = Object.entries(fieldEdits).map(
      ([fieldId, value]) => ({ fieldId, fieldValueText: value }),
    );
    // Persist the fund total commitment so the derived % stays reproducible.
    // Amendments resize the fund server-side, so the frontend never sets it.
    if (
      !isAmendment &&
      fundTotalCommitment > 0 &&
      fundTotalCommitment !== parseFloat(fundData?.targetCommitment ?? "")
    ) {
      try {
        await updateFund(fundId, { targetCommitment: fundTotalCommitment });
        queryClient.invalidateQueries({
          queryKey: ["fund", fundId, "details"],
        });
      } catch (err) {
        toast.error(toFriendlyMessage(err));
        return;
      }
    }
    approveMutation.mutate({
      items,
      approveNotes: notes || undefined,
      approveFieldUpdates:
        approveFieldUpdates.length > 0 ? approveFieldUpdates : undefined,
    });
  };

  // ── Derived state ──────────────────────────────────────────
  const workspaceDocuments = (documents ?? [])
    .filter(isWorkspaceDocument)
    .sort((a, b) => {
      const aHasParent = !!a.parentDocumentId;
      const bHasParent = !!b.parentDocumentId;
      if (aHasParent !== bHasParent) return aHasParent ? 1 : -1;
      if (aHasParent && bHasParent) {
        if (a.parentDocumentId !== b.parentDocumentId)
          return (a.parentDocumentId ?? "").localeCompare(
            b.parentDocumentId ?? "",
          );
        return (a.version ?? 0) - (b.version ?? 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  useEffect(() => {
    const requested = searchParams.get("document");
    if (
      requested &&
      documents?.some(
        (doc) => doc.documentId === requested && isWorkspaceDocument(doc),
      )
    ) {
      setSelectedDocId(requested);
    } else if (!selectedDocId && documents?.length) {
      setSelectedDocId(documents.find(isWorkspaceDocument)?.documentId ?? null);
    }
  }, [documents, searchParams, selectedDocId]);

  const selectedDoc = documents?.find((d) => d.documentId === selectedDocId);
  const isParsed = parseStatusData?.parseStatus === "COMPLETED";
  const isApproved = !!(selectedDoc?.metadata as Record<string, unknown>)
    ?.approved;
  const isMasterLpa = selectedDoc?.documentType === "MASTER_LPA";
  const isAmendment = selectedDoc?.documentType === "LPA_AMENDMENT";
  // A doc qualifies for subscription creation once it is "ready": a parsed
  // Master LPA or a COMPLETED amendment (amendments skip the parse step).
  const isSubscriptionReady = isParsed && (isMasterLpa || isAmendment);

  // Validity of the draft allocation set. Master LPA: must total exactly 100%.
  // Amendment: must fit within the fund's remaining headroom.
  const draftTotalPct = subscriptionDrafts.reduce(
    (sum, d) => sum + d.allocationPct,
    0,
  );
  // Amendment: dollar-anchored. New committed capital expands the fund and the
  // cap table re-normalizes server-side, so the only requirement is that the
  // admin entered at least some new capital.
  const draftCommittedTotal = subscriptionDrafts.reduce(
    (sum, d) => sum + d.committedAmount,
    0,
  );
  const existingFundCommitted = fundAllocation?.totalCommitted ?? 0;
  const amendmentFundTotal = existingFundCommitted + draftCommittedTotal;
  const amendmentDraftPct =
    amendmentFundTotal > 0
      ? (draftCommittedTotal / amendmentFundTotal) * 100
      : 0;
  const isDraftAllocationValid = isAmendment
    ? draftCommittedTotal > 0
    : Math.abs(draftTotalPct - 100) <= 0.01;
  const eligibleInvestors =
    investors?.filter(
      (inv) =>
        inv.fundEligibility?.status === "APPROVED" ||
        inv.fundEligibility?.status === "ELIGIBLE",
    ) ?? [];

  // ── Notice table columns ───────────────────────────────────

  const noticeRows: NoticeRow[] = (notices ?? []).map((n: Notice) => {
    const delivery = n.deliveries?.[0];
    const effectiveStatus = delivery?.status ?? "GENERATED";
    return {
      id: n.id,
      deliveryId: delivery?.id ?? null,
      type: n.type,
      recipientName: n.investor?.legalName ?? n.recipientInvestorId,
      generatedAt: n.generatedAt,
      documentHash: n.documentHash ?? "",
      anchorTxHash: n.anchorTxHash ?? "",
      sentAt: delivery?.sentAt ?? "",
      openedAt: delivery?.openedAt ?? "",
      downloadedAt: delivery?.downloadedAt ?? "",
      status: effectiveStatus,
    };
  });

  const noticeColumns: Column<NoticeRow>[] = [
    {
      key: "type",
      header: "Notice Type",
      render: (r) => (
        <span className="font-medium text-foreground">{r.type}</span>
      ),
    },
    { key: "recipientName", header: "Recipient LP" },
    {
      key: "generatedAt",
      header: "Date Generated",
      render: (r) =>
        r.generatedAt ? new Date(r.generatedAt).toLocaleDateString() : "--",
    },
    {
      key: "documentHash",
      header: "Document Hash",
      render: (r) => {
        if (!r.documentHash) return <span className="text-gray-400">--</span>;
        return (
          <span className="inline-flex items-center gap-1">
            <span className="font-mono text-xs text-foreground">
              {truncateHash(r.documentHash)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(r.documentHash);
              }}
              className="text-gray-400 hover:text-gray-600 p-0.5"
              title="Copy hash"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </span>
        );
      },
    },
    {
      key: "anchorTxHash",
      header: "Anchor Transaction",
      render: (r) =>
        r.anchorTxHash ? (
          <ExplorerLink value={r.anchorTxHash} type="tx" />
        ) : (
          <span className="text-gray-400">--</span>
        ),
    },
    {
      key: "sentAt",
      header: "Sent",
      render: (r) => (r.sentAt ? new Date(r.sentAt).toLocaleString() : "--"),
    },
    {
      key: "openedAt",
      header: "Opened",
      render: (r) =>
        r.openedAt ? new Date(r.openedAt).toLocaleString() : "--",
    },
    {
      key: "downloadedAt",
      header: "Downloaded",
      render: (r) =>
        r.downloadedAt ? new Date(r.downloadedAt).toLocaleString() : "--",
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div className="flex items-center gap-2">
          {noticeStatusBadge(r.status)}
          {r.deliveryId && (
            <select
              value=""
              onChange={(e) => {
                const next = e.target.value;
                if (!next || !r.deliveryId) return;
                updateDeliveryMutation.mutate({
                  noticeId: r.id,
                  deliveryId: r.deliveryId,
                  status: next,
                });
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border border-border bg-card px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
              aria-label="Update delivery status"
            >
              <option value="">Mark as…</option>
              <option value="SENT">Sent</option>
              <option value="VIEWED">Opened</option>
              <option value="DOWNLOADED">Downloaded</option>
            </select>
          )}
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Browse source documents, inspect provenance, and review extracted terms."
        action={
          <Button
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("tab", "upload");
              setSearchParams(next);
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Add documents
          </Button>
        }
      />

      {/* Success banner */}
      {approveSuccess !== null && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>
            Document approved successfully. {approveSuccess} subscription
            {approveSuccess !== 1 ? "s" : ""} created.
          </span>
          <button
            onClick={() => setApproveSuccess(null)}
            className="ml-auto text-green-600 hover:text-green-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabbed sections */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams);
          next.set("tab", value);
          setSearchParams(next);
        }}
        className="w-full"
      >
        <TabsList className="mb-6">
          <TabsTrigger value="governing" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Governing Documents
          </TabsTrigger>
          <TabsTrigger value="notices" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Generated Notices
          </TabsTrigger>
          <TabsTrigger value="reporting" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reporting
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Document Upload
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Governing Documents */}
        <TabsContent
          value="governing"
          className="grid items-start gap-4 data-[state=inactive]:hidden xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.65fr)]"
        >
          <SectionCard
            title={`Documents · ${documents?.filter(isWorkspaceDocument).length ?? "…"}`}
            className="min-w-0 xl:sticky xl:top-0"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => anchorPendingMutation.mutate()}
                disabled={anchorPendingMutation.isPending}
                className="gap-1.5"
              >
                <ShieldCheck className="h-4 w-4" />
                {anchorPendingMutation.isPending
                  ? "Anchoring…"
                  : "Anchor Pending"}
              </Button>
            }
          >
            {docsLoading && (
              <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading documents...
              </div>
            )}
            {docsError && (
              <ErrorAlert
                title="Unable to load documents"
                message={`${(docsError as Error).message}. Try refreshing the page.`}
              />
            )}
            {!docsLoading &&
              !docsError &&
              (!documents || documents.length === 0) && (
                <EmptyState
                  title="No documents uploaded"
                  message="Upload a Master LPA to get started. The document will be parsed and its hash anchored on-chain."
                />
              )}
            {documents && documents.length > 0 && (
              <div>
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    aria-label="Search documents"
                    value={documentSearch}
                    onChange={(event) => setDocumentSearch(event.target.value)}
                    placeholder="Search or select a document…"
                    className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs"
                  />
                </div>
                <div
                  className="max-h-[65vh] space-y-2 overflow-y-auto"
                  aria-label="Source documents"
                >
                  {workspaceDocuments
                    .filter((doc) =>
                      `${doc.originalFilename} ${doc.documentType}`
                        .toLowerCase()
                        .includes(documentSearch.trim().toLowerCase()),
                    )
                    .map((doc) => (
                      <button
                        key={doc.documentId}
                        type="button"
                        aria-pressed={selectedDocId === doc.documentId}
                        onClick={() => {
                          setSelectedDocId(doc.documentId);
                          const next = new URLSearchParams(searchParams);
                          next.set("document", doc.documentId);
                          setSearchParams(next, { replace: true });
                        }}
                        className={`block w-full rounded-md border p-3 text-left transition-colors ${selectedDocId === doc.documentId ? "border-primary/60 bg-primary/5" : "border-border hover:bg-muted"}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="workspace-eyebrow truncate">
                            {friendlyDocumentType(doc.documentType)}
                          </span>
                          <StatusBadge
                            status={mapParseStatus(doc.parseStatus)}
                          />
                        </div>
                        <span className="block break-words text-[13px] font-medium text-foreground">
                          {doc.originalFilename}
                        </span>
                        <span className="mt-2 flex gap-2 text-[10px] text-muted-foreground">
                          <span>
                            {Math.max(1, Math.round(doc.byteSize / 1024))} KB
                          </span>
                          <span className="rounded border border-border px-1">
                            v{doc.version ?? 1}
                          </span>
                          <span>
                            {doc.extractedFieldCount ?? 0} extracted fields
                          </span>
                        </span>
                        <span className="mt-1.5 block text-[10px] text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString()} ·{" "}
                          {doc.hash?.anchoredOnchain
                            ? "Anchored"
                            : "Not anchored"}
                        </span>
                      </button>
                    ))}
                  {!workspaceDocuments.some((doc) =>
                    `${doc.originalFilename} ${doc.documentType}`
                      .toLowerCase()
                      .includes(documentSearch.trim().toLowerCase()),
                  ) && (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      No documents match this search.
                    </p>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          <div className="min-w-0">
            {/* Document Detail (only shown when a doc is selected) */}
            {selectedDoc && (
              <>
                {/* Info + Hashes */}
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="min-w-0 break-words text-sm font-medium">
                    {selectedDoc.originalFilename}
                  </h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setViewerDoc({
                        id: selectedDoc.documentId,
                        filename: selectedDoc.originalFilename,
                      })
                    }
                  >
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    View source
                  </Button>
                </div>
                <SectionCard title="Provenance" className="mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Basic Info */}
                    <div className="space-y-4">
                      <DetailRow
                        label="Document Name"
                        value={selectedDoc.originalFilename}
                      />
                      <DetailRow
                        label="Document ID"
                        value={selectedDoc.documentId}
                        mono
                      />
                      <DetailRow
                        label="Uploaded"
                        value={new Date(selectedDoc.createdAt).toLocaleString()}
                      />
                      <DetailRow
                        label="Document Type"
                        value={selectedDoc.documentType ?? "Master LPA"}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Parse Status
                        </span>
                        <StatusBadge
                          status={mapParseStatus(
                            parseStatusData?.parseStatus ??
                              selectedDoc.parseStatus,
                          )}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Hash Status
                        </span>
                        <StatusBadge
                          status={mapHashStatus(
                            parseStatusData?.hashStatus ??
                              (selectedDoc.hash?.anchoredOnchain
                                ? "ANCHORED"
                                : "PENDING"),
                          )}
                        />
                      </div>
                      {parseStatusData?.extractionSummary && (
                        <>
                          <DetailRow
                            label="Fields Extracted"
                            value={String(
                              parseStatusData.extractionSummary.fieldsExtracted,
                            )}
                          />
                          <DetailRow
                            label="Low Confidence Fields"
                            value={String(
                              parseStatusData.extractionSummary
                                .lowConfidenceFields,
                            )}
                          />
                        </>
                      )}
                    </div>

                    {/* Right: Verification summary + expandable details */}
                    <div>
                      {hashesData && hashesData.length > 0 ? (
                        <div className="space-y-3">
                          {/* Summary: show verification status at a glance */}
                          <div className="flex items-center gap-2 py-2">
                            <ShieldCheck className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-medium text-foreground">
                              {
                                hashesData.filter(
                                  (h: DocumentHash) => h.anchoredOnchain,
                                ).length
                              }{" "}
                              of {hashesData.length} hash
                              {hashesData.length !== 1 ? "es" : ""} verified and
                              anchored
                            </span>
                          </div>

                          <TechnicalDetails label="Verification Details">
                            <div className="space-y-3">
                              {hashesData.map((h: DocumentHash) => (
                                <div
                                  key={h.hashId}
                                  className="rounded-md border border-border p-3"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-muted-foreground uppercase">
                                      {h.algorithm}
                                    </span>
                                    <StatusBadge
                                      status={
                                        h.anchoredOnchain
                                          ? "Completed"
                                          : "Pending"
                                      }
                                    />
                                  </div>
                                  <p className="text-xs font-mono text-foreground break-all">
                                    {h.hashHex}
                                  </p>
                                  {h.anchor && (
                                    <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                                      <p>Chain ID: {h.anchor.chainId}</p>
                                      <p className="break-all flex items-center gap-1">
                                        Tx:{" "}
                                        <ExplorerLink
                                          value={h.anchor.txHash}
                                          type="tx"
                                        />
                                      </p>
                                      {h.anchor.blockNumber && (
                                        <p>Block: {h.anchor.blockNumber}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TechnicalDetails>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                          <Clock className="h-4 w-4" />
                          Hash computation in progress...
                        </div>
                      )}
                    </div>
                  </div>
                </SectionCard>

                {/* Wire confirmation info */}
                {selectedDoc.documentType === "WIRE_CONFIRMATION" && (
                  <SectionCard title="Wire Confirmation" className="mb-6">
                    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                      <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">Payment Evidence Document</p>
                        <p className="text-blue-600 mt-1">
                          Wire confirmations are used during settlement
                          validation to verify payment. Each document is
                          cryptographically hashed for tamper-proof provenance.
                        </p>
                      </div>
                    </div>
                  </SectionCard>
                )}

                {/* Extracted Fields */}
                {isParsed && isMasterLpa && (
                  <SectionCard
                    title={
                      isApproved
                        ? "Extracted Fields (Approved)"
                        : "Extracted Fields (Review & Edit)"
                    }
                    className="mb-6"
                  >
                    {extractedFields.length === 0 ? (
                      <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        No extracted fields available.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Field Name
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Value
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {extractedFields.map((field) => (
                              <tr
                                key={field.fieldId}
                                className="border-b border-border"
                              >
                                <td className="px-4 py-3 text-foreground font-medium">
                                  {field.fieldName}
                                </td>
                                <td className="px-4 py-3">
                                  {isApproved ? (
                                    <span className="text-foreground">
                                      {fieldDisplayValue(field)}
                                    </span>
                                  ) : (
                                    <input
                                      type="text"
                                      value={
                                        fieldEdits[field.fieldId] !== undefined
                                          ? fieldEdits[field.fieldId]
                                          : fieldDisplayValue(field)
                                      }
                                      onChange={(e) =>
                                        setFieldEdits((prev) => ({
                                          ...prev,
                                          [field.fieldId]: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Save edits button (only before approval) */}
                    {!isApproved && Object.keys(fieldEdits).length > 0 && (
                      <div className="mt-4 flex justify-end">
                        <Button
                          onClick={handleSaveFields}
                          disabled={saveFieldsMutation.isPending}
                          variant="outline"
                          className="text-gray-700"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {saveFieldsMutation.isPending
                            ? "Saving..."
                            : "Save Field Changes"}
                        </Button>
                      </div>
                    )}
                  </SectionCard>
                )}

                {/* Admin Notes (before approval, MASTER_LPA only) */}
                {isParsed && isMasterLpa && !isApproved && (
                  <SectionCard title="Admin Notes" className="mb-6">
                    <div className="flex items-start gap-2 mb-2">
                      <StickyNote className="h-4 w-4 text-muted-foreground mt-1" />
                      <span className="text-sm text-muted-foreground">
                        Add notes or comments for this document review. These
                        will be saved when you approve the document.
                      </span>
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter additional notes, observations, or instructions..."
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </SectionCard>
                )}

                {/* Show saved notes on approved docs */}
                {isParsed &&
                  isMasterLpa &&
                  isApproved &&
                  (selectedDoc?.metadata as Record<string, unknown>)?.notes && (
                    <SectionCard title="Admin Notes" className="mb-6">
                      <p className="text-sm text-foreground">
                        {String(
                          (selectedDoc?.metadata as Record<string, unknown>)
                            ?.notes,
                        )}
                      </p>
                    </SectionCard>
                  )}

                {/* Eligible Investors (Master LPA + LPA Amendment) */}
                {isSubscriptionReady && (
                  <SectionCard
                    title={
                      isAmendment
                        ? "Eligible Investors (Amendment Allocation)"
                        : "Eligible Investors"
                    }
                    className="mb-6"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                      <MetricCard
                        label="Total Eligible"
                        value={eligibleInvestors.length}
                      />
                      <MetricCard
                        label="With Wallets"
                        value={
                          eligibleInvestors.filter((i) => i.wallets.length > 0)
                            .length
                        }
                      />
                      <MetricCard
                        label="Fields Extracted"
                        value={extractedFields.length}
                      />
                    </div>

                    {eligibleInvestors.length === 0 ? (
                      <EmptyState
                        title="No eligible investors"
                        message="No investors are currently eligible for this fund. Approve investor eligibility before creating subscriptions."
                      />
                    ) : (
                      <>
                        <div className="overflow-x-auto mb-4">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                  Investor
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                  Email
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                  Wallet
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                  Verification
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                  Eligibility
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {eligibleInvestors.map((inv) => {
                                const wallet =
                                  inv.wallets.find((w) => w.isPrimary) ??
                                  inv.wallets[0];
                                return (
                                  <tr
                                    key={inv.investorId}
                                    className="border-b border-border"
                                  >
                                    <td className="px-4 py-3 font-medium text-foreground">
                                      {inv.legalName}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                      {inv.email}
                                    </td>
                                    <td className="px-4 py-3">
                                      <HashDisplay
                                        value={wallet?.address}
                                        fallback="None"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <StatusBadge
                                        status={inv.verificationStatus}
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <StatusBadge
                                        status={
                                          inv.fundEligibility?.status ??
                                          "Unknown"
                                        }
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {!isApproved && (
                          <div className="flex justify-end">
                            <Button
                              onClick={openApproveModal}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Review & Create Subscriptions
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </SectionCard>
                )}
              </>
            )}
            {!selectedDoc && (
              <SectionCard title="Source detail">
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Select a document to inspect its provenance and extracted
                  terms.
                </p>
              </SectionCard>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Generated Notices */}
        <TabsContent value="notices">
          <SectionCard
            title="Generated Notices"
            action={
              <Button
                size="sm"
                onClick={() => setShowGenerateNoticeModal(true)}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Generate Notice
              </Button>
            }
          >
            {noticesLoading && (
              <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Loading notices...
              </div>
            )}
            {!noticesLoading && noticeRows.length === 0 && (
              <EmptyState
                title="No notices generated"
                message="Generated notices will appear here once capital calls or other notice-triggering events occur."
              />
            )}
            {!noticesLoading && noticeRows.length > 0 && (
              <NoticeTableWithFilter
                noticeRows={noticeRows}
                noticeColumns={noticeColumns}
              />
            )}
          </SectionCard>
        </TabsContent>

        {/* Tab 3: Reporting */}
        <TabsContent value="reporting">
          <ReportingSection
            fundId={fundId}
            onView={(doc) =>
              setViewerDoc({ id: doc.documentId, filename: doc.fileName })
            }
          />
        </TabsContent>

        {/* Tab 4: Document Upload */}
        <TabsContent value="upload">
          {DEMO_MODE ? (
            <SectionCard title="Uploads are disabled in this demo">
              <p className="text-sm text-muted-foreground">Explore the fictional sources in Governing Documents. Personal files are not needed for this preview.</p>
            </SectionCard>
          ) : (
          <SectionCard title="Upload Document" className="mb-6">
            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              {/* Document type — drives which backend endpoint is called. */}
              <div>
                <label
                  htmlFor="doc-type-select"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Document Type
                </label>
                <select
                  id="doc-type-select"
                  value={uploadDocType}
                  onChange={(e) => {
                    const next = e.target.value as GoverningDocumentType;
                    setUploadDocType(next);
                    // Clear parent selection when switching to/from Master LPA.
                    setUploadParentId("");
                    setUploadError(null);
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {GOVERNING_DOCUMENT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {uploadDocType === "MASTER_LPA"
                    ? "The fund's governing limited-partnership agreement."
                    : "Modifies an existing Master LPA. Cap-table calculations apply the LPA + all amendments."}
                </p>
              </div>

              {/* Parent picker — only shown for amendments / side letters / joinders. */}
              {selectedTypeRequiresParent && (
                <div>
                  <label
                    htmlFor="amends-select"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Amends Document <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="amends-select"
                    value={uploadParentId}
                    onChange={(e) => {
                      setUploadParentId(e.target.value);
                      setUploadError(null);
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">— Select a Master LPA —</option>
                    {(documents ?? [])
                      .filter((d) => d.documentType === "MASTER_LPA")
                      .map((d) => (
                        <option key={d.documentId} value={d.documentId}>
                          v{d.version ?? 1} · {d.originalFilename}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    The amendment is anchored on-chain alongside the original
                    LPA's hash, so future investors see the full history.
                  </p>
                </div>
              )}

              {/* Effective date — optional, only relevant for amendments. */}
              {selectedTypeRequiresParent && (
                <div>
                  <label
                    htmlFor="effective-date"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Effective Date
                  </label>
                  <input
                    id="effective-date"
                    type="date"
                    value={uploadEffectiveDate}
                    onChange={(e) => setUploadEffectiveDate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    When this amendment takes legal effect. Optional — leave
                    blank to use the upload date.
                  </p>
                </div>
              )}
            </div>

            {/* Drag/drop upload zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors
                ${
                  isDragOver
                    ? "border-primary bg-muted/50"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }
              `}
            >
              <Upload className="h-10 w-10 text-gray-400 mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                {uploadMutation.isPending
                  ? "Uploading..."
                  : "Drop a PDF here, or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">
                Accepted format: PDF. The document will be verified, parsed, and
                cryptographically anchored after admin approval.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleInputChange}
                className="hidden"
              />
            </div>

            {uploadMutation.isPending && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Uploading and processing document...
              </div>
            )}

            {(uploadMutation.isError || uploadError) && (
              <div className="mt-4">
                <ErrorAlert
                  title="Upload Failed"
                  message={
                    uploadError ??
                    (uploadMutation.error as Error | undefined)?.message ??
                    "Unknown error"
                  }
                />
              </div>
            )}

            {uploadMutation.isSuccess && !uploadMutation.isPending && (
              <div className="mt-4 flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Document uploaded successfully. Processing has begun.
              </div>
            )}
          </SectionCard>
          )}
        </TabsContent>
      </Tabs>

      {/* Approve Modal */}
      <Dialog
        open={showApproveModal}
        onOpenChange={(open) => {
          setShowApproveModal(open);
          if (!open) setShowAddDropdown(false);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Confirm Subscription Creation
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {isAmendment
                ? "Enter each LP's new committed capital. The amendment expands the fund and every LP's allocation % re-normalizes to 100% of the new fund size."
                : "Enter each LP's committed amount. Allocation % is derived from the fund total commitment below and must total 100%."}
            </DialogDescription>
          </DialogHeader>

          {isAmendment ? (
            /* Amendment: the fund expands by the new capital entered below. */
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="mb-2 font-medium text-foreground">
                Amendment expands the fund
              </p>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="block text-muted-foreground">
                    Current fund size
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {fmt(existingFundCommitted)}
                  </span>
                </div>
                <div>
                  <span className="block text-muted-foreground">
                    This amendment adds
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {fmt(draftCommittedTotal)}
                  </span>
                </div>
                <div>
                  <span className="block text-muted-foreground">
                    New fund size
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {fmt(amendmentFundTotal)}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Existing LPs dilute proportionally; allocation % re-normalizes
                to 100% of the new fund size.
              </p>
            </div>
          ) : (
            /* Fund total commitment — drives every derived allocation % */
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <label
                htmlFor="fund-total-commitment"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Fund Total Commitment (USD)
              </label>
              <input
                id="fund-total-commitment"
                type="number"
                step="100000"
                min="0"
                value={fundTotalCommitment || ""}
                onChange={(e) =>
                  updateFundTotal(parseFloat(e.target.value) || 0)
                }
                placeholder="e.g. 10000000"
                className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Each LP's allocation % = committed amount / fund total
                commitment.
              </p>
            </div>
          )}

          {/* Investor table */}
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Investor
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Wallet
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Allocation %
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Committed Amount
                  </th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {subscriptionDrafts.map((draft, idx) => (
                  <tr key={draft.investorId} className="border-b border-border">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {draft.investorName}
                    </td>
                    <td className="px-3 py-2">
                      <HashDisplay
                        value={draft.walletAddress}
                        fallback="None"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-block w-20 rounded-md bg-muted px-2 py-1 text-sm text-foreground tabular-nums"
                        title={
                          isAmendment
                            ? "Allocation % after this amendment expands the fund"
                            : "Derived from committed amount / fund total commitment"
                        }
                      >
                        {(isAmendment
                          ? amendmentFundTotal > 0
                            ? (draft.committedAmount / amendmentFundTotal) * 100
                            : 0
                          : draft.allocationPct
                        ).toFixed(2)}
                        %
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        value={draft.committedAmount}
                        onChange={(e) =>
                          updateDraftAmount(
                            idx,
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() =>
                          removeInvestorFromDrafts(draft.investorId)
                        }
                        className="rounded-full p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title={`Remove ${draft.investorName}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {subscriptionDrafts.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-sm text-muted-foreground"
                    >
                      No investors added yet. Use the button below to add
                      investors.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add investor + redistribute buttons */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <button
                onClick={() => setShowAddDropdown(!showAddDropdown)}
                className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-muted-foreground hover:border-gray-400 hover:text-foreground transition-colors w-full"
              >
                <Plus className="h-4 w-4" />
                Add Investor
              </button>

              {showAddDropdown &&
                (() => {
                  const draftIds = new Set(
                    subscriptionDrafts.map((d) => d.investorId),
                  );
                  const available = (investors ?? []).filter(
                    (inv) =>
                      !draftIds.has(inv.investorId) &&
                      (inv.fundEligibility?.status === "APPROVED" ||
                        inv.fundEligibility?.status === "ELIGIBLE"),
                  );
                  const filtered = investorSearch
                    ? available.filter(
                        (inv) =>
                          inv.legalName
                            .toLowerCase()
                            .includes(investorSearch.toLowerCase()) ||
                          inv.email
                            .toLowerCase()
                            .includes(investorSearch.toLowerCase()),
                      )
                    : available;

                  return (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-card shadow-lg">
                      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                        <Search className="h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={investorSearch}
                          onChange={(e) => setInvestorSearch(e.target.value)}
                          placeholder="Search by name or email..."
                          className="flex-1 text-sm text-foreground placeholder-gray-400 outline-none"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {filtered.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                            {available.length === 0
                              ? "All eligible investors are already added"
                              : "No matching investors"}
                          </div>
                        ) : (
                          filtered.map((inv) => {
                            const wallet =
                              inv.wallets.find((w) => w.isPrimary) ??
                              inv.wallets[0];
                            return (
                              <button
                                key={inv.investorId}
                                onClick={() => addInvestorToDrafts(inv)}
                                className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                              >
                                <div>
                                  <span className="font-medium text-foreground">
                                    {inv.legalName}
                                  </span>
                                  <span className="ml-2 text-muted-foreground">
                                    {inv.email}
                                  </span>
                                </div>
                                {wallet && (
                                  <HashDisplay value={wallet.address} />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })()}
            </div>

            {!isAmendment && (
              <Button
                variant="outline"
                size="sm"
                onClick={redistributeEqually}
                disabled={subscriptionDrafts.length === 0}
                className="text-muted-foreground whitespace-nowrap"
              >
                Split Equally
              </Button>
            )}
          </div>

          {/* Totals row.
              Master LPA: new subscriptions must fill the fund (sum of amounts
              == fund total => 100%). Amendment top-up: new allocations only
              need to fit within the fund's remaining headroom. */}
          {(() => {
            const totalAmt = subscriptionDrafts.reduce(
              (sum, d) => sum + d.committedAmount,
              0,
            );
            return (
              <>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3 text-sm">
                  <span className="font-medium text-gray-700">
                    {subscriptionDrafts.length} investor
                    {subscriptionDrafts.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-6">
                    <span className="text-muted-foreground">
                      {isAmendment ? "New LP allocation:" : "Allocation:"}{" "}
                      <span
                        className={`font-semibold ${isDraftAllocationValid ? "text-green-700" : "text-red-600"}`}
                      >
                        {(isAmendment
                          ? amendmentDraftPct
                          : draftTotalPct
                        ).toFixed(2)}
                        %
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Committed:{" "}
                      <span className="font-semibold text-foreground">
                        {fmt(totalAmt)}
                      </span>
                    </span>
                  </div>
                </div>

                {!isDraftAllocationValid && subscriptionDrafts.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {isAmendment
                        ? "Enter a committed amount for at least one LP to expand the fund."
                        : `Total allocation is ${draftTotalPct.toFixed(2)}% -- must equal 100%.`}
                    </span>
                  </div>
                )}
              </>
            );
          })()}

          {approveMutation.isError && (
            <ErrorAlert
              title="Approval Failed"
              message={(approveMutation.error as Error).message}
            />
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveModal(false)}
              disabled={approveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={
                approveMutation.isPending ||
                subscriptionDrafts.length === 0 ||
                !isDraftAllocationValid
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {approveMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </div>
              ) : (
                `Create ${subscriptionDrafts.length} Subscription${subscriptionDrafts.length !== 1 ? "s" : ""}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Notice Modal */}
      <Dialog
        open={showGenerateNoticeModal}
        onOpenChange={(open) => {
          setShowGenerateNoticeModal(open);
          if (!open) {
            createNoticeMutation.reset();
            setBodyTouched(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Notice</DialogTitle>
            <DialogDescription>
              Create a notice record for an investor. Notices are backed by the
              audit log and can be linked to a capital call or distribution run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={noticeForm.type}
                onChange={(e) => {
                  setNoticeForm((prev) => ({
                    ...prev,
                    type: e.target.value as typeof prev.type,
                  }));
                  setBodyTouched(false);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="GENERAL">General</option>
                <option value="CAPITAL_CALL">Capital Call</option>
                <option value="DISTRIBUTION">Distribution</option>
                <option value="TRANSFER">Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient
              </label>
              <select
                value={noticeForm.recipientInvestorId}
                onChange={(e) => {
                  setNoticeForm((prev) => ({
                    ...prev,
                    recipientInvestorId: e.target.value,
                  }));
                  setBodyTouched(false);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select an investor…</option>
                {(investors ?? []).map((inv) => (
                  <option key={inv.investorId} value={inv.investorId}>
                    {inv.legalName} ({inv.email})
                  </option>
                ))}
              </select>
            </div>
            {noticeForm.type === "CAPITAL_CALL" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capital Call
                </label>
                <select
                  value={noticeForm.capitalCallId}
                  onChange={(e) => {
                    setNoticeForm((prev) => ({
                      ...prev,
                      capitalCallId: e.target.value,
                    }));
                    setBodyTouched(false);
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select a capital call…</option>
                  {(capitalCalls ?? []).map((call) => (
                    <option key={call.id} value={call.id}>
                      Call #{call.callNumber} — $
                      {Number(call.amountDue).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {noticeForm.type === "DISTRIBUTION" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Distribution Run ID
                </label>
                <input
                  type="text"
                  value={noticeForm.distributionRunId}
                  onChange={(e) =>
                    setNoticeForm((prev) => ({
                      ...prev,
                      distributionRunId: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
            <div className="border-t border-border pt-4">
              <NoticeBodyEditor
                value={{ subject: noticeForm.subject, body: noticeForm.body }}
                availableTokens={availableTokens}
                disabled={createNoticeMutation.isPending}
                onChange={(next) => {
                  setNoticeForm((prev) => ({
                    ...prev,
                    subject: next.subject,
                    body: next.body,
                  }));
                  setBodyTouched(true);
                }}
              />
            </div>
            {createNoticeMutation.isError && (
              <ErrorAlert
                title="Unable to generate notice"
                message={toFriendlyMessage(createNoticeMutation.error)}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowGenerateNoticeModal(false)}
              disabled={createNoticeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createNoticeMutation.mutate()}
              disabled={
                createNoticeMutation.isPending ||
                !noticeForm.recipientInvestorId
              }
            >
              {createNoticeMutation.isPending ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Viewer Modal */}
      {viewerDoc && (
        <DocumentViewerModal
          open={viewerDoc !== null}
          onOpenChange={(open) => {
            if (!open) setViewerDoc(null);
          }}
          contentPath={`/admin/documents/${viewerDoc.id}/content`}
          filename={viewerDoc.filename}
        />
      )}
    </div>
  );
}

// ── Shared sub-component ─────────────────────────────────────

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm text-foreground ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
