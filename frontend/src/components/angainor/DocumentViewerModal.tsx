import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_BASE_URL, AUTH_TOKEN_KEY } from "@/config/constants";

export interface DocumentViewerModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Absolute API path (relative to API_BASE_URL) of the auth-protected content endpoint. */
  readonly contentPath: string;
  /** Filename shown in header + used as the download filename. */
  readonly filename: string;
}

/**
 * Fetches an auth-protected document as a blob and previews it in an iframe
 * (PDF / HTML) or <img> (images). For other file types a download CTA is
 * rendered. Revokes the blob URL on close.
 */
export function DocumentViewerModal({
  open,
  onOpenChange,
  contentPath,
  filename,
}: DocumentViewerModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createdUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setMimeType(null);

    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    fetch(`${API_BASE_URL}${contentPath}`, { headers })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            text || `Unable to load document (${res.status})`,
          );
        }
        const contentType = res.headers.get("Content-Type") ?? "application/octet-stream";
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        createdUrlRef.current = url;
        setBlobUrl(url);
        setMimeType(contentType);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load document");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, contentPath]);

  // Revoke blob URL when the modal closes or the component unmounts.
  useEffect(() => {
    if (!open && createdUrlRef.current) {
      URL.revokeObjectURL(createdUrlRef.current);
      createdUrlRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (createdUrlRef.current) {
        URL.revokeObjectURL(createdUrlRef.current);
        createdUrlRef.current = null;
      }
    };
  }, []);

  const isPdf = mimeType?.includes("pdf");
  const isImage = mimeType?.startsWith("image/");
  const isHtml = mimeType?.includes("html");
  const canEmbed = isPdf || isImage || isHtml;

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    if (!blobUrl) return;
    window.open(blobUrl, "_blank", "noopener");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 bg-white rounded-lg overflow-hidden [&>button]:hidden">
        <DialogHeader className="border-b border-border px-6 py-4 flex flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base font-semibold text-gray-900 truncate pr-4">
            {filename}
          </DialogTitle>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenNewTab}
              disabled={!blobUrl}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!blobUrl}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center rounded-md h-7 w-7 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="bg-gray-50" style={{ height: "min(80vh, 720px)" }}>
          {loading && (
            <div className="flex items-center justify-center h-full text-sm text-gray-600">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mr-2" />
              Loading document...
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <p className="text-sm font-medium text-red-700 mb-2">
                Unable to load document
              </p>
              <p className="text-xs text-gray-600">{error}</p>
            </div>
          )}
          {!loading && !error && blobUrl && isPdf && (
            <iframe
              title={filename}
              src={blobUrl}
              className="h-full w-full border-0 bg-white"
            />
          )}
          {!loading && !error && blobUrl && isImage && (
            <div className="flex items-center justify-center h-full overflow-auto p-4">
              <img
                src={blobUrl}
                alt={filename}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          {!loading && !error && blobUrl && isHtml && (
            <iframe
              title={filename}
              src={blobUrl}
              sandbox=""
              className="h-full w-full border-0 bg-white"
            />
          )}
          {!loading && !error && blobUrl && !canEmbed && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <p className="text-sm font-medium text-gray-900 mb-1">
                Preview not available
              </p>
              <p className="text-xs text-gray-600 mb-4">
                This file type cannot be previewed in the browser.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download to view
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
