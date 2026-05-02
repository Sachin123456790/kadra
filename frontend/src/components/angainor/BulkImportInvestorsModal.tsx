import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  bulkImportInvestors,
  type BulkImportResult,
  type BulkImportRowResult,
} from "@/services/investors.service";
import { QUERY_KEYS } from "@/config/constants";
import { toFriendlyMessage } from "@/lib/errorMessages";

interface BulkImportInvestorsModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly fundId: string;
}

const TEMPLATE_HEADER = [
  "legalName",
  "email",
  "password",
  "taxId",
  "country",
  "kycStatus",
  "accreditationStatus",
  "verificationStatus",
  "eligibility",
  "walletAddress",
  "chainId",
];

const TEMPLATE_EXAMPLES = [
  [
    "Alpine Capital Partners",
    "alpine-import@example.com",
    "AlpineLP2024",
    "12-3456789",
    "US",
    "APPROVED",
    "APPROVED",
    "VERIFIED",
    "GRANTED",
    "0x1111111111111111111111111111111111111111",
    "11155111",
  ],
  [
    "Bridgewater Associates",
    "bridge-import@example.com",
    "BridgewaterLP2024",
    "",
    "US",
    "APPROVED",
    "APPROVED",
    "",
    "NONE",
    "",
    "",
  ],
  [
    "Cascade Investment LLC",
    "cascade-import@example.com",
    "CascadeLP2024",
    "",
    "US",
    "PENDING",
    "PENDING",
    "",
    "NONE",
    "",
    "",
  ],
];

function buildTemplateCsv(): string {
  const escape = (cell: string) =>
    /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  const lines = [
    TEMPLATE_HEADER.join(","),
    ...TEMPLATE_EXAMPLES.map((row) => row.map(escape).join(",")),
  ];
  return lines.join("\n");
}

function downloadTemplate() {
  const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "investor-import-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadResultsCsv(rows: BulkImportRowResult[]) {
  const headers = ["row", "legalName", "email", "status", "investorId", "message"];
  const escape = (cell: string) =>
    /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  const body = rows.map((r) =>
    [
      String(r.rowNumber),
      r.legalName ?? "",
      r.email ?? "",
      r.status,
      r.investorId ?? "",
      r.message ?? "",
    ]
      .map(escape)
      .join(","),
  );
  const csv = [headers.join(","), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `investor-import-results-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function statusBadge(status: BulkImportRowResult["status"]) {
  if (status === "CREATED") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        Created
      </Badge>
    );
  }
  if (status === "SKIPPED_DUPLICATE") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        Skipped (duplicate)
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Failed</Badge>
  );
}

export function BulkImportInvestorsModal({
  open,
  onOpenChange,
  fundId,
}: BulkImportInvestorsModalProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Please choose a CSV or XLSX file");
      const res = await bulkImportInvestors(fundId, file);
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.investors(fundId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.subscriptions(fundId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.capTable(fundId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.activityFeed(fundId),
      });
      const msg =
        `Imported ${data.succeeded} of ${data.total}` +
        (data.skipped ? ` (${data.skipped} skipped)` : "") +
        (data.failed ? ` (${data.failed} failed)` : "");
      if (data.failed > 0) {
        toast.warning(msg);
      } else {
        toast.success(msg);
      }
    },
    onError: (err) => {
      toast.error(toFriendlyMessage(err));
    },
  });

  const handleClose = (next: boolean) => {
    if (!next) {
      setFile(null);
      setResult(null);
      mutation.reset();
    }
    onOpenChange(next);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Bulk import investors
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Upload a CSV or XLSX file. Each row creates an investor + login,
            and (optionally) marks KYC, accreditation, eligibility, and a
            wallet address. Duplicates are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-dashed border-border p-4">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Predefined format
                  </div>
                  <p className="text-xs text-gray-600">
                    Required columns: legalName, email, password. Optional:
                    taxId, country, kycStatus, accreditationStatus,
                    verificationStatus, eligibility, walletAddress, chainId.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="shrink-0"
              >
                <Download className="mr-2 h-4 w-4" />
                Template
              </Button>
            </div>

            <label
              htmlFor="bulk-investor-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-8 text-center hover:bg-muted/60"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <div className="text-sm font-medium text-gray-900">
                {file ? file.name : "Click to choose a CSV or XLSX file"}
              </div>
              <p className="text-xs text-gray-500">
                Up to 50MB. Header row required. One investor per row.
              </p>
              <input
                id="bulk-investor-file"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={onFileChange}
              />
            </label>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                disabled={!file || mutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 rounded-md border border-border bg-muted/30 px-4 py-3 text-center">
              <div>
                <div className="text-xs uppercase text-muted-foreground">
                  Total
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {result.total}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-emerald-700">
                  Created
                </div>
                <div className="text-lg font-semibold text-emerald-800">
                  {result.succeeded}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-amber-700">Skipped</div>
                <div className="text-lg font-semibold text-amber-800">
                  {result.skipped}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-red-700">Failed</div>
                <div className="text-lg font-semibold text-red-800">
                  {result.failed}
                </div>
              </div>
            </div>

            <div className="max-h-80 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr
                      key={r.rowNumber}
                      className="border-t border-border align-top"
                    >
                      <td className="px-3 py-2 text-gray-600">{r.rowNumber}</td>
                      <td className="px-3 py-2 text-gray-900">
                        {r.legalName ?? ""}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {r.email ?? ""}
                      </td>
                      <td className="px-3 py-2">{statusBadge(r.status)}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {r.message ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => downloadResultsCsv(result.rows)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download report
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => handleClose(false)}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
