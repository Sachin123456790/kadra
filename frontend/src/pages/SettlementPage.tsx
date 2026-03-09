import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Upload,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import {
  getSubscriptions,
  requestPaymentValidation,
  confirmSettlement,
  uploadWireConfirmation,
} from "@/services";
import type { ValidationResult } from "@/services/settlements.service";

const checkItems = [
  { label: "Amount Match", key: "checkAmountMatch" },
  { label: "Investor Match", key: "checkInvestorMatch" },
  { label: "Reference Match", key: "checkReferenceMatch" },
  { label: "No Double Settlement", key: "checkNoDoubleSettlement" },
];

const StatusIcon = ({ s }: { s: string }) => {
  if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (s === "fail") return <XCircle className="h-4 w-4 text-red-600" />;
  return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
};

interface QueueItem {
  id: string;
  subscriptionId: string;
  investor: string;
  investorId: string;
  amount: string;
  rawAmount: string;
  ref: string;
  status: string;
}

export default function SettlementPage() {
  const fundId = DEFAULT_FUND_CODE;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<
    Record<string, ValidationResult>
  >({});
  const [paymentDocIds, setPaymentDocIds] = useState<Record<string, string>>(
    {},
  );
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<string, { name: string; documentId: string }>
  >({});

  const {
    data: queue,
    isLoading,
    error,
  } = useQuery({
    queryKey: [...QUERY_KEYS.subscriptions(fundId), "PENDING"],
    queryFn: () => getSubscriptions(fundId, "PENDING").then((r) => r.data),
    select: (data): QueueItem[] =>
      data.map((sub) => ({
        id: sub.subscriptionId,
        subscriptionId: sub.subscriptionId,
        investor: sub.investorName || sub.investorId,
        investorId: sub.investorId,
        amount: `$${Number(sub.committedAmount).toLocaleString()}`,
        rawAmount: String(sub.committedAmount),
        ref: sub.subscriptionRef,
        status: sub.latestSettlementStatus ?? "Pending",
      })),
  });

  const {
    data: settledSubs,
    isLoading: settledLoading,
  } = useQuery({
    queryKey: [...QUERY_KEYS.subscriptions(fundId), "SETTLED"],
    queryFn: () => getSubscriptions(fundId, "SETTLED").then((r) => r.data),
  });

  const selected =
    queue?.find((q) => q.id === selectedId) ?? queue?.[0] ?? null;

  // Mutation: upload wire confirmation
  const uploadMutation = useMutation({
    mutationFn: ({
      investorId,
      file,
    }: {
      investorId: string;
      file: File;
      itemId: string;
    }) => uploadWireConfirmation(fundId, investorId, file).then((r) => r.data),
    onSuccess: (result, variables) => {
      setUploadedFiles((prev) => ({
        ...prev,
        [variables.itemId]: {
          name: variables.file.name,
          documentId: result.documentId,
        },
      }));
      setPaymentDocIds((prev) => ({
        ...prev,
        [variables.itemId]: result.documentId,
      }));
    },
  });

  // Mutation: validate payment
  const validateMutation = useMutation({
    mutationFn: (item: QueueItem) =>
      requestPaymentValidation(item.subscriptionId, {
        paymentDocumentId: paymentDocIds[item.id] || "",
        declaredAmount: item.rawAmount,
        declaredCurrency: "USD",
        declaredReference: item.ref,
      }).then((r) => r.data),
    onSuccess: (result, item) => {
      setValidationResults((prev) => ({ ...prev, [item.id]: result }));
    },
  });

  // Mutation: confirm settlement
  const confirmMutation = useMutation({
    mutationFn: ({
      subscriptionId,
      settlementRecordId,
    }: {
      subscriptionId: string;
      settlementRecordId: string;
    }) =>
      confirmSettlement(subscriptionId, settlementRecordId).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.subscriptions(fundId),
      });
    },
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error)
    return (
      <ErrorAlert
        title="Failed to load settlement queue"
        message={(error as Error).message}
      />
    );

  const hasPending = queue && queue.length > 0;

  const currentValidation = selected
    ? validationResults[selected.id]
    : null;
  const currentUpload = selected ? uploadedFiles[selected.id] : null;
  const hasPaymentDoc = !!(selected && paymentDocIds[selected.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    uploadMutation.mutate({
      investorId: selected.investorId,
      file,
      itemId: selected.id,
    });
    e.target.value = "";
  };

  return (
    <div>
      <PageHeader
        title="Settlement"
        subtitle="Upload wire confirmations and verify payment evidence against subscription terms"
      />

      {/* Settlement History */}
      {settledSubs && settledSubs.length > 0 && (
        <SectionCard title={`Settlement History (${settledSubs.length})`} className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Investor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Allocation</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Settled At</th>
                </tr>
              </thead>
              <tbody>
                {settledSubs.map((sub) => (
                  <tr key={sub.subscriptionId} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{sub.investorName || sub.investorId}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{sub.subscriptionRef}</td>
                    <td className="px-4 py-3 text-gray-900">${Number(sub.committedAmount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-900">{Number(sub.allocationPct)}%</td>
                    <td className="px-4 py-3"><StatusBadge status="Settled" /></td>
                    <td className="px-4 py-3 text-gray-600">{sub.settledAt ? new Date(sub.settledAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {!hasPending && (!settledSubs || settledSubs.length === 0) && (
        <EmptyState
          title="No settlements"
          message="No subscriptions have been created yet."
        />
      )}

      {hasPending && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Payment Evidence Queue">
          <div className="space-y-2">
            {queue.map((p) => {
              const uploaded = uploadedFiles[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-md border border-border p-3 text-left transition-colors",
                    selected?.id === p.id
                      ? "bg-sidebar-accent border-primary/30"
                      : "hover:bg-muted",
                  )}
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {p.investor}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.amount} · {p.ref}
                    </p>
                    {uploaded && (
                      <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {uploaded.name}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={p.status} />
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Validation Checklist">
          {selected && (
            <>
              {/* Wire Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Wire Confirmation (PDF)
                </label>
                {currentUpload ? (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3">
                    <FileText className="h-4 w-4 text-green-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {currentUpload.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        ID: {currentUpload.documentId.slice(0, 8)}...
                      </p>
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-primary hover:underline"
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 p-4 text-sm text-gray-500 hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload wire confirmation PDF
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {uploadMutation.isError && (
                  <p className="mt-1 text-xs text-red-600">
                    Upload failed:{" "}
                    {(uploadMutation.error as Error).message}
                  </p>
                )}
              </div>

              {/* Validation Checks */}
              <div className="space-y-3 mb-4">
                {checkItems.map((ci) => {
                  let result: "pass" | "fail" | "pending" = "pending";
                  if (currentValidation) {
                    const checkValue =
                      currentValidation.checks[
                        ci.key as keyof typeof currentValidation.checks
                      ];
                    result =
                      checkValue === true
                        ? "pass"
                        : checkValue === false
                          ? "fail"
                          : "pending";
                  }
                  return (
                    <div
                      key={ci.key}
                      className="flex items-center justify-between rounded-md border border-border p-3"
                    >
                      <span className="text-sm text-gray-700">{ci.label}</span>
                      <div className="flex items-center gap-2">
                        <StatusIcon s={result} />
                        <span className="text-xs font-medium capitalize text-gray-500">
                          {result}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {currentValidation?.status === "FAILED" && (
                <ErrorAlert
                  title="Validation Failed"
                  message={
                    currentValidation.failureReasonCode ??
                    "One or more checks did not pass. Manual review required."
                  }
                />
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => selected && validateMutation.mutate(selected)}
                  disabled={
                    !hasPaymentDoc || validateMutation.isPending
                  }
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {validateMutation.isPending ? "Validating..." : "Validate"}
                </button>
                <button
                  onClick={() => {
                    if (selected && currentValidation?.settlementRecordId) {
                      confirmMutation.mutate({
                        subscriptionId: selected.subscriptionId,
                        settlementRecordId:
                          currentValidation.settlementRecordId,
                      });
                    }
                  }}
                  disabled={
                    !currentValidation ||
                    currentValidation.status !== "PASSED" ||
                    confirmMutation.isPending
                  }
                  className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {confirmMutation.isPending
                    ? "Confirming..."
                    : "Confirm Settlement"}
                </button>
              </div>

              {!hasPaymentDoc && !uploadMutation.isPending && (
                <p className="mt-2 text-xs text-amber-600">
                  Upload a wire confirmation PDF before validating.
                </p>
              )}

              {confirmMutation.isError && (
                <ErrorAlert
                  title="Settlement failed"
                  message={(confirmMutation.error as Error).message}
                  className="mt-3"
                />
              )}

              {validateMutation.isError && (
                <ErrorAlert
                  title="Validation failed"
                  message={(validateMutation.error as Error).message}
                  className="mt-3"
                />
              )}
            </>
          )}
        </SectionCard>
      </div>
      )}
    </div>
  );
}
