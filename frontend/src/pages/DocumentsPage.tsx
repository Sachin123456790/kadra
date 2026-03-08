import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DEFAULT_FUND_CODE, QUERY_KEYS } from "@/config/constants";
import { uploadMasterLpa, getParseStatus, getDocumentHashes } from "@/services";
import type { UploadResult, ParseStatus, DocumentHash } from "@/services/documents.service";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { Upload, FileText, CheckCircle2, Clock, Hash } from "lucide-react";

interface UploadedDocument {
  documentId: string;
  fileName: string;
  uploadedAt: string;
  parseStatus: string;
  hashStatus: string;
}

const documentColumns: Column<UploadedDocument>[] = [
  {
    key: "fileName",
    header: "Document",
    render: (row) => (
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-gray-500" />
        <span className="font-medium text-gray-900">{row.fileName}</span>
      </div>
    ),
  },
  {
    key: "documentId",
    header: "Document ID",
    className: "font-mono text-xs",
  },
  {
    key: "uploadedAt",
    header: "Uploaded At",
    render: (row) => (
      <span className="text-gray-600">{new Date(row.uploadedAt).toLocaleString()}</span>
    ),
  },
  {
    key: "parseStatus",
    header: "Parse Status",
    render: (row) => <StatusBadge status={mapParseStatus(row.parseStatus)} />,
  },
  {
    key: "hashStatus",
    header: "Hash Status",
    render: (row) => <StatusBadge status={mapHashStatus(row.hashStatus)} />,
  },
];

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

export default function DocumentsPage() {
  const fundId = DEFAULT_FUND_CODE;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadMasterLpa(fundId, file).then((r) => r.data),
    onSuccess: (data: UploadResult, file: File) => {
      const newDoc: UploadedDocument = {
        documentId: data.documentId,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        parseStatus: data.parseStatus,
        hashStatus: data.hashStatus,
      };
      setUploadedDocs((prev) => [newDoc, ...prev]);
      setSelectedDocId(data.documentId);
    },
  });

  // Parse status polling for selected document
  const { data: parseStatusData } = useQuery({
    queryKey: QUERY_KEYS.documentParseStatus(selectedDocId ?? ""),
    queryFn: () => getParseStatus(selectedDocId!).then((r) => r.data),
    enabled: !!selectedDocId,
    refetchInterval: (query) => {
      const status = query.state.data?.parseStatus;
      return status === "QUEUED" || status === "PROCESSING" ? 3000 : false;
    },
  });

  // Document hashes for selected document
  const { data: hashesData } = useQuery({
    queryKey: QUERY_KEYS.documentHashes(selectedDocId ?? ""),
    queryFn: () => getDocumentHashes(selectedDocId!).then((r) => r.data),
    enabled: !!selectedDocId,
  });

  const handleFileSelect = useCallback(
    (file: File) => {
      if (file.type !== "application/pdf") {
        return;
      }
      uploadMutation.mutate(file);
    },
    [uploadMutation],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset so the same file can be selected again
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Update parse status in local list when polling returns new data
  if (parseStatusData && selectedDocId) {
    const idx = uploadedDocs.findIndex((d) => d.documentId === selectedDocId);
    if (idx >= 0 && uploadedDocs[idx].parseStatus !== parseStatusData.parseStatus) {
      setUploadedDocs((prev) =>
        prev.map((d) =>
          d.documentId === selectedDocId
            ? { ...d, parseStatus: parseStatusData.parseStatus, hashStatus: parseStatusData.hashStatus }
            : d,
        ),
      );
    }
  }

  const selectedDoc = uploadedDocs.find((d) => d.documentId === selectedDocId);

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Upload and manage fund governing documents"
      />

      {/* Upload Zone */}
      <SectionCard title="Upload Master LPA" className="mb-6">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 cursor-pointer transition-colors
            ${isDragOver
              ? "border-primary bg-primary/5"
              : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            }
          `}
        >
          <Upload className="h-10 w-10 text-gray-400 mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">
            {uploadMutation.isPending ? "Uploading..." : "Drop a PDF here, or click to browse"}
          </p>
          <p className="text-xs text-gray-500">
            Accepted format: PDF. The document will be hashed (SHA-256) and anchored on-chain.
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
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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

      {/* Document Detail (when a document is selected) */}
      {selectedDoc && parseStatusData && (
        <SectionCard title="Document Details" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Basic Info */}
            <div className="space-y-4">
              <DetailRow label="Document Name" value={selectedDoc.fileName} />
              <DetailRow label="Document ID" value={selectedDoc.documentId} mono />
              <DetailRow label="Uploaded At" value={new Date(selectedDoc.uploadedAt).toLocaleString()} />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Parse Status</span>
                <StatusBadge status={mapParseStatus(parseStatusData.parseStatus)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Hash Status</span>
                <StatusBadge status={mapHashStatus(parseStatusData.hashStatus)} />
              </div>
              {parseStatusData.extractionSummary && (
                <>
                  <DetailRow
                    label="Fields Extracted"
                    value={String(parseStatusData.extractionSummary.fieldsExtracted)}
                  />
                  <DetailRow
                    label="Low Confidence Fields"
                    value={String(parseStatusData.extractionSummary.lowConfidenceFields)}
                  />
                </>
              )}
              <DetailRow label="Last Updated" value={new Date(parseStatusData.updatedAt).toLocaleString()} />
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
                    <div key={h.hashId} className="rounded-md border border-gray-200 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600 uppercase">{h.algorithm}</span>
                        <StatusBadge status={h.anchoredOnchain ? "Completed" : "Pending"} />
                      </div>
                      <p className="text-xs font-mono text-gray-900 break-all">{h.hashHex}</p>
                      {h.anchor && (
                        <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                          <p>Chain ID: {h.anchor.chainId}</p>
                          <p className="break-all">Tx: {h.anchor.txHash}</p>
                          {h.anchor.blockNumber && <p>Block: {h.anchor.blockNumber}</p>}
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
      )}

      {/* Uploaded Documents Table */}
      <SectionCard title="Uploaded Documents">
        {uploadedDocs.length === 0 ? (
          <EmptyState
            title="No documents uploaded"
            message="Upload a Master LPA to get started. The document will be parsed and its hash anchored on-chain."
          />
        ) : (
          <DataTable
            columns={documentColumns}
            data={uploadedDocs}
            getRowId={(row) => row.documentId}
            onRowClick={(row) => setSelectedDocId(row.documentId)}
            selectedId={selectedDocId ?? undefined}
          />
        )}
      </SectionCard>
    </div>
  );
}

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
      <span className={`text-sm text-gray-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
