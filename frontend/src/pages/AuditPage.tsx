import { useState, useCallback } from 'react';
import { useQueries, useMutation } from '@tanstack/react-query';
import { DEFAULT_FUND_CODE, QUERY_KEYS } from '@/config/constants';
import { createAuditExport, getAuditExport, downloadAuditExport } from '@/services';
import type { AuditExportDetail } from '@/services/audit.service';
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";

function triggerCsvDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function DownloadButton({ exportId, status }: { exportId: string; status: string }) {
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
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  }, [exportId]);

  if (status !== 'READY') return <span className="text-xs text-gray-500">--</span>;

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
    >
      {downloading ? 'Downloading...' : 'Download'}
    </button>
  );
}

const columns: Column<AuditExportDetail>[] = [
  { key: "auditExportId", header: "Export ID", className: "font-mono text-xs" },
  { key: "exportType", header: "Type" },
  { key: "requestedAt", header: "Requested At", render: (r) => new Date(r.requestedAt).toLocaleString() },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status === 'READY' ? 'Completed' : r.status === 'BUILDING' || r.status === 'QUEUED' ? 'Processing' : r.status} /> },
  {
    key: "artifact" as keyof AuditExportDetail,
    header: "Download",
    render: (r) => <DownloadButton exportId={r.auditExportId} status={r.status} />,
  },
];

export default function AuditPage() {
  const fundId = DEFAULT_FUND_CODE;
  const [exportIds, setExportIds] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: () => createAuditExport(fundId).then(r => r.data),
    onSuccess: (data) => {
      setExportIds((prev) => [data.auditExportId, ...prev]);
    },
  });

  return (
    <div>
      <PageHeader
        title="Audit & Exports"
        subtitle="Generate compliance packets and download export artifacts"
        action={
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Generating...' : 'Generate Audit Packet'}
          </button>
        }
      />
      {createMutation.isError && (
        <div className="mb-4">
          <ErrorAlert
            title="Export Generation Failed"
            message={(createMutation.error as Error).message}
          />
        </div>
      )}
      <SectionCard>
        {exportIds.length === 0 ? (
          <EmptyState
            title="No exports yet"
            message="Click 'Generate Audit Packet' to create a compliance export."
          />
        ) : (
          <AuditExportTable exportIds={exportIds} />
        )}
      </SectionCard>
    </div>
  );
}

/** Renders the table by fetching details for each export ID */
function AuditExportTable({ exportIds }: { exportIds: string[] }) {
  const results = useQueries({
    queries: exportIds.map((id) => ({
      queryKey: QUERY_KEYS.auditExport(id),
      queryFn: () => getAuditExport(id).then((r) => r.data),
      refetchInterval: (query: { state: { data?: { status?: string } } }) => {
        const status = query.state.data?.status;
        return status === 'QUEUED' || status === 'BUILDING' ? 3000 : false;
      },
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  if (isLoading) return <div className="p-6">Loading...</div>;

  const exports = results
    .map((r) => r.data)
    .filter((d): d is NonNullable<typeof d> => d != null);

  return (
    <DataTable columns={columns} data={exports} getRowId={(r) => r.auditExportId} />
  );
}
