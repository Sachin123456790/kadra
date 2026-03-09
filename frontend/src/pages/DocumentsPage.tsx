import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_FUND_CODE, QUERY_KEYS } from "@/config/constants";
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
import type {
  UploadResult,
  ParseStatus,
  DocumentHash,
  FundDocument,
  ExtractedField,
  FieldUpdate,
  SubscriptionItem,
} from "@/services/documents.service";
import type { Investor } from "@/services/investors.service";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import { MetricCard } from "@/components/kadra/MetricCard";
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
} from "lucide-react";

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

function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return "text-green-700 bg-green-50";
  if (confidence >= 0.7) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

// ── Table columns ────────────────────────────────────────────

/** Get display value from an extracted field (text takes priority, then numeric) */
function fieldDisplayValue(f: ExtractedField): string {
  if (f.fieldValueText) return f.fieldValueText;
  if (f.fieldValueNumeric != null) return String(f.fieldValueNumeric);
  return "";
}

const documentColumns: Column<FundDocument>[] = [
  {
    key: "originalFilename",
    header: "Document",
    render: (row) => (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-gray-500" />
        <span className="font-medium text-gray-900">{row.originalFilename}</span>
      </div>
    ),
  },
  {
    key: "documentType",
    header: "Type",
    render: (row) => (
      <span className="text-gray-600">{row.documentType ?? "Master LPA"}</span>
    ),
  },
  {
    key: "parseStatus",
    header: "Parse Status",
    render: (row) => <StatusBadge status={mapParseStatus(row.parseStatus)} />,
  },
  {
    key: "hash",
    header: "Hash Status",
    render: (row) => <StatusBadge status={row.hash?.anchoredOnchain ? "Completed" : "Pending"} />,
  },
  {
    key: "createdAt",
    header: "Uploaded",
    render: (row) => (
      <span className="text-gray-600">
        {new Date(row.createdAt).toLocaleString()}
      </span>
    ),
  },
];

// ── Subscription draft row for the modal ─────────────────────

interface SubscriptionDraft {
  investorId: string;
  investorName: string;
  walletId: string;
  walletAddress: string;
  allocationPct: number;
  committedAmount: number;
}

// ── Main component ──────────────────────────────────────────

export default function DocumentsPage() {
  const fundId = DEFAULT_FUND_CODE;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<
    SubscriptionDraft[]
  >([]);
  const [approveSuccess, setApproveSuccess] = useState<number | null>(null);
  const [fieldEdits, setFieldEdits] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  // ── Queries ────────────────────────────────────────────────

  const {
    data: documents,
    isLoading: docsLoading,
    error: docsError,
  } = useQuery({
    queryKey: QUERY_KEYS.documents(fundId),
    queryFn: () => getDocuments(fundId).then((r) => r.data),
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
    enabled:
      !!selectedDocId && parseStatusData?.parseStatus === "COMPLETED",
  });

  const { data: investors } = useQuery({
    queryKey: QUERY_KEYS.investors(fundId),
    queryFn: () => getInvestors(fundId).then((r) => r.data),
  });

  const extractedFields = extractedFieldsData ?? [];

  // ── Mutations ──────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      uploadMasterLpa(fundId, file).then((r) => r.data),
    onSuccess: (_data: UploadResult) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.documents(fundId),
      });
      setSelectedDocId(_data.documentId);
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

  // ── File handling ──────────────────────────────────────────

  const handleFileSelect = useCallback(
    (file: File) => {
      if (file.type !== "application/pdf") return;
      uploadMutation.mutate(file);
    },
    [uploadMutation],
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
    const fieldMap = new Map(
      extractedFields.map((f) => [f.fieldName.toLowerCase(), fieldDisplayValue(f)]),
    );
    return parseFloat(fieldMap.get("total_commitment") ?? "0") || 10000000;
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
    const equalPct = parseFloat((100 / eligible.length).toFixed(2));
    const commitPerLp = totalCommitment / eligible.length;

    const drafts: SubscriptionDraft[] = eligible.map((inv) => {
      const primaryWallet =
        inv.wallets.find((w) => w.isPrimary) ?? inv.wallets[0];
      return {
        investorId: inv.investorId,
        investorName: inv.legalName,
        walletId: primaryWallet?.walletId ?? "",
        walletAddress: primaryWallet?.address ?? "No wallet",
        allocationPct: equalPct,
        committedAmount: commitPerLp,
      };
    });

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
    const totalCommitment = getTotalCommitment();
    const equalPct = parseFloat((100 / subscriptionDrafts.length).toFixed(2));
    const commitPerLp = totalCommitment / subscriptionDrafts.length;
    setSubscriptionDrafts((prev) =>
      prev.map((d) => ({
        ...d,
        allocationPct: equalPct,
        committedAmount: commitPerLp,
      })),
    );
  };

  const updateDraft = (
    index: number,
    field: "allocationPct" | "committedAmount",
    value: number,
  ) => {
    setSubscriptionDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    );
  };

  const handleSaveFields = () => {
    const updates: FieldUpdate[] = Object.entries(fieldEdits).map(
      ([fieldId, value]) => ({ fieldId, fieldValueText: value }),
    );
    if (updates.length > 0) saveFieldsMutation.mutate(updates);
  };

  const handleApprove = () => {
    const items: SubscriptionItem[] = subscriptionDrafts.map((d) => ({
      investorId: d.investorId,
      walletId: d.walletId,
      allocationPct: d.allocationPct,
      committedAmount: d.committedAmount,
    }));
    const approveFieldUpdates: FieldUpdate[] = Object.entries(fieldEdits).map(
      ([fieldId, value]) => ({ fieldId, fieldValueText: value }),
    );
    approveMutation.mutate({
      items,
      approveNotes: notes || undefined,
      approveFieldUpdates:
        approveFieldUpdates.length > 0 ? approveFieldUpdates : undefined,
    });
  };

  // ── Derived state ──────────────────────────────────────────

  const selectedDoc = documents?.find(
    (d) => d.documentId === selectedDocId,
  );
  const isParsed = parseStatusData?.parseStatus === "COMPLETED";
  const isApproved = !!(selectedDoc?.metadata as Record<string, unknown>)?.approved;
  const isMasterLpa = selectedDoc?.documentType === "MASTER_LPA";
  const eligibleInvestors =
    investors?.filter(
      (inv) =>
        inv.fundEligibility?.status === "APPROVED" ||
        inv.fundEligibility?.status === "ELIGIBLE",
    ) ?? [];

  // ── Render ─────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Upload, review, and approve fund governing documents"
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

      {/* Section 1: Upload Zone */}
      <SectionCard title="Upload Master LPA" className="mb-6">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors
            ${
              isDragOver
                ? "border-indigo-500 bg-indigo-50/50"
                : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            }
          `}
        >
          <Upload className="h-10 w-10 text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">
            {uploadMutation.isPending
              ? "Uploading..."
              : "Drop a PDF here, or click to browse"}
          </p>
          <p className="text-xs text-gray-500">
            Accepted format: PDF. The document will be hashed (SHA-256) and
            parsed. On-chain anchoring occurs after admin approval.
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
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Uploading and processing document...
          </div>
        )}

        {uploadMutation.isError && (
          <div className="mt-4">
            <ErrorAlert
              title="Upload Failed"
              message={(uploadMutation.error as Error).message}
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

      {/* Section 2: Documents List */}
      <SectionCard title="Uploaded Documents" className="mb-6">
        {docsLoading && (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Loading documents...
          </div>
        )}
        {docsError && (
          <ErrorAlert
            title="Failed to load documents"
            message={(docsError as Error).message}
          />
        )}
        {!docsLoading && !docsError && (!documents || documents.length === 0) && (
          <EmptyState
            title="No documents uploaded"
            message="Upload a Master LPA to get started. The document will be parsed and its hash anchored on-chain."
          />
        )}
        {documents && documents.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            <DataTable
              columns={documentColumns}
              data={documents}
              getRowId={(row) => row.documentId}
              onRowClick={(row) => setSelectedDocId(row.documentId)}
              selectedId={selectedDocId ?? undefined}
            />
          </div>
        )}
      </SectionCard>

      {/* Section 3: Document Detail */}
      {selectedDoc && (
        <>
          {/* Info + Hashes */}
          <SectionCard title="Document Details" className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Basic Info */}
              <div className="space-y-4">
                <DetailRow label="Document Name" value={selectedDoc.originalFilename} />
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
                  <span className="text-sm text-gray-500">Parse Status</span>
                  <StatusBadge
                    status={mapParseStatus(
                      parseStatusData?.parseStatus ?? selectedDoc.parseStatus,
                    )}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Hash Status</span>
                  <StatusBadge
                    status={mapHashStatus(
                      parseStatusData?.hashStatus ?? (selectedDoc.hash?.anchoredOnchain ? "ANCHORED" : "PENDING"),
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
                        parseStatusData.extractionSummary.lowConfidenceFields,
                      )}
                    />
                  </>
                )}
              </div>

              {/* Right: Hashes */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4 text-gray-500" />
                  Cryptographic Hashes
                </h4>
                {hashesData && hashesData.length > 0 ? (
                  <div className="space-y-3">
                    {hashesData.map((h: DocumentHash) => (
                      <div
                        key={h.hashId}
                        className="rounded-md border border-gray-200 p-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-600 uppercase">
                            {h.algorithm}
                          </span>
                          <StatusBadge
                            status={
                              h.anchoredOnchain ? "Completed" : "Pending"
                            }
                          />
                        </div>
                        <p className="text-xs font-mono text-gray-900 break-all">
                          {h.hashHex}
                        </p>
                        {h.anchor && (
                          <div className="mt-2 text-xs text-gray-500 space-y-0.5">
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
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
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
                    Wire confirmations are used during settlement validation to verify payment.
                    Their SHA-256 hash is anchored on-chain for tamper-proof provenance.
                  </p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Extracted Fields — only for MASTER_LPA, editable before approval, read-only after */}
          {isParsed && isMasterLpa && (
            <SectionCard
              title={isApproved ? "Extracted Fields (Approved)" : "Extracted Fields (Review & Edit)"}
              className="mb-6"
            >
              {extractedFields.length === 0 ? (
                <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  No extracted fields available.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Field Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Value
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                          Confidence
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedFields.map((field) => (
                        <tr
                          key={field.fieldId}
                          className="border-b border-gray-100"
                        >
                          <td className="px-4 py-3 text-gray-900 font-medium">
                            {field.fieldName}
                          </td>
                          <td className="px-4 py-3">
                            {isApproved ? (
                              <span className="text-gray-900">
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
                                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${confidenceColor(field.confidence)}`}
                            >
                              {(field.confidence * 100).toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Low-confidence warning */}
              {extractedFields.some((f) => f.confidence < 0.7) && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Some fields have low confidence scores. Review carefully
                    before creating subscriptions.
                  </span>
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
                    {saveFieldsMutation.isPending ? "Saving..." : "Save Field Changes"}
                  </Button>
                </div>
              )}
            </SectionCard>
          )}

          {/* Admin Notes (before approval, MASTER_LPA only) */}
          {isParsed && isMasterLpa && !isApproved && (
            <SectionCard title="Admin Notes" className="mb-6">
              <div className="flex items-start gap-2 mb-2">
                <StickyNote className="h-4 w-4 text-gray-500 mt-1" />
                <span className="text-sm text-gray-600">
                  Add notes or comments for this document review. These will be
                  saved when you approve the document.
                </span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter additional notes, observations, or instructions..."
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </SectionCard>
          )}

          {/* Show saved notes on approved docs (MASTER_LPA only) */}
          {isParsed && isMasterLpa && isApproved && (selectedDoc?.metadata as Record<string, unknown>)?.notes && (
            <SectionCard title="Admin Notes" className="mb-6">
              <p className="text-sm text-gray-900">
                {String((selectedDoc?.metadata as Record<string, unknown>)?.notes)}
              </p>
            </SectionCard>
          )}

          {/* Eligible Investors (MASTER_LPA only) */}
          {isParsed && isMasterLpa && (
            <SectionCard title="Eligible Investors" className="mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <MetricCard
                  label="Total Eligible"
                  value={eligibleInvestors.length}
                />
                <MetricCard
                  label="With Wallets"
                  value={
                    eligibleInvestors.filter((i) => i.wallets.length > 0).length
                  }
                />
                <MetricCard
                  label="Fields Extracted"
                  value={extractedFields.length}
                />
                <MetricCard
                  label="Low Confidence"
                  value={extractedFields.filter((f) => f.confidence < 0.7).length}
                  subtitle={
                    extractedFields.filter((f) => f.confidence < 0.7).length > 0
                      ? "Review recommended"
                      : undefined
                  }
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
                        <tr className="border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Investor
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Email
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Wallet
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            Verification
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
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
                              className="border-b border-gray-100"
                            >
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {inv.legalName}
                              </td>
                              <td className="px-4 py-3 text-gray-600">
                                {inv.email}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-gray-600">
                                {wallet
                                  ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
                                  : "None"}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge
                                  status={inv.verificationStatus}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge
                                  status={
                                    inv.fundEligibility?.status ?? "Unknown"
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
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
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

      {/* Approve Modal */}
      <Dialog open={showApproveModal} onOpenChange={(open) => {
        setShowApproveModal(open);
        if (!open) setShowAddDropdown(false);
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Confirm Subscription Creation
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Add or remove investors below. Allocation must total 100%.
            </DialogDescription>
          </DialogHeader>

          {/* Investor table */}
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Investor
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Wallet
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Allocation %
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Committed Amount
                  </th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {subscriptionDrafts.map((draft, idx) => (
                  <tr key={draft.investorId} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {draft.investorName}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600">
                      {draft.walletAddress
                        ? `${draft.walletAddress.slice(0, 6)}...${draft.walletAddress.slice(-4)}`
                        : "None"}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={draft.allocationPct}
                        onChange={(e) =>
                          updateDraft(idx, "allocationPct", parseFloat(e.target.value) || 0)
                        }
                        className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        value={draft.committedAmount}
                        onChange={(e) =>
                          updateDraft(idx, "committedAmount", parseFloat(e.target.value) || 0)
                        }
                        className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeInvestorFromDrafts(draft.investorId)}
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
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">
                      No investors added yet. Use the button below to add investors.
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
                className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors w-full"
              >
                <Plus className="h-4 w-4" />
                Add Investor
              </button>

              {showAddDropdown && (() => {
                const draftIds = new Set(subscriptionDrafts.map((d) => d.investorId));
                const available = (investors ?? []).filter(
                  (inv) =>
                    !draftIds.has(inv.investorId) &&
                    (inv.fundEligibility?.status === "APPROVED" ||
                      inv.fundEligibility?.status === "ELIGIBLE"),
                );
                const filtered = investorSearch
                  ? available.filter((inv) =>
                      inv.legalName.toLowerCase().includes(investorSearch.toLowerCase()) ||
                      inv.email.toLowerCase().includes(investorSearch.toLowerCase()),
                    )
                  : available;

                return (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-gray-200 bg-white shadow-lg">
                    <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                      <Search className="h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={investorSearch}
                        onChange={(e) => setInvestorSearch(e.target.value)}
                        placeholder="Search by name or email..."
                        className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {filtered.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-gray-500 text-center">
                          {available.length === 0
                            ? "All eligible investors are already added"
                            : "No matching investors"}
                        </div>
                      ) : (
                        filtered.map((inv) => {
                          const wallet = inv.wallets.find((w) => w.isPrimary) ?? inv.wallets[0];
                          return (
                            <button
                              key={inv.investorId}
                              onClick={() => addInvestorToDrafts(inv)}
                              className="flex items-center justify-between w-full px-3 py-2 text-sm text-left hover:bg-indigo-50 transition-colors"
                            >
                              <div>
                                <span className="font-medium text-gray-900">{inv.legalName}</span>
                                <span className="ml-2 text-gray-500">{inv.email}</span>
                              </div>
                              {wallet && (
                                <span className="font-mono text-xs text-gray-400">
                                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                                </span>
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

            <Button
              variant="outline"
              size="sm"
              onClick={redistributeEqually}
              disabled={subscriptionDrafts.length === 0}
              className="text-gray-600 whitespace-nowrap"
            >
              Split Equally
            </Button>
          </div>

          {/* Totals row */}
          {(() => {
            const totalPct = subscriptionDrafts.reduce((sum, d) => sum + d.allocationPct, 0);
            const totalAmt = subscriptionDrafts.reduce((sum, d) => sum + d.committedAmount, 0);
            const isValid = Math.abs(totalPct - 100) <= 0.01;
            return (
              <>
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                  <span className="font-medium text-gray-700">
                    {subscriptionDrafts.length} investor{subscriptionDrafts.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex items-center gap-6">
                    <span className="text-gray-600">
                      Allocation:{" "}
                      <span className={`font-semibold ${isValid ? "text-green-700" : "text-red-600"}`}>
                        {totalPct.toFixed(2)}%
                      </span>
                    </span>
                    <span className="text-gray-600">
                      Committed:{" "}
                      <span className="font-semibold text-gray-900">{fmt(totalAmt)}</span>
                    </span>
                  </div>
                </div>

                {!isValid && subscriptionDrafts.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      Total allocation is {totalPct.toFixed(2)}% -- must equal 100%.
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
                Math.abs(
                  subscriptionDrafts.reduce((sum, d) => sum + d.allocationPct, 0) - 100,
                ) > 0.01
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
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
      <span className="text-sm text-gray-500">{label}</span>
      <span
        className={`text-sm text-gray-900 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
