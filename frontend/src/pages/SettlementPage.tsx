import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import { TechnicalDetails } from "@/components/kadra/TechnicalDetails";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Upload,
  FileText,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import {
  getSubscriptions,
  requestPaymentValidation,
  confirmSettlement,
  uploadWireConfirmation,
} from "@/services";
import {
  getCapitalCalls,
  createCapitalCall,
} from "@/services/capital-calls.service";
import type { CapitalCall } from "@/services/capital-calls.service";
import type { ValidationResult } from "@/services/settlements.service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Helpers ──────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const capitalCallStatusColor: Record<string, string> = {
  ISSUED: "bg-blue-100 text-blue-800",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-800",
  CLOSED: "bg-green-100 text-green-800",
};

function CapitalCallStatusBadge({ status }: { readonly status: string }) {
  const cls = capitalCallStatusColor[status] ?? "bg-gray-100 text-gray-800";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        cls,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const checkItems = [
  { label: "Amount Match", key: "checkAmountMatch" },
  { label: "Investor Match", key: "checkInvestorMatch" },
  { label: "Reference Match", key: "checkReferenceMatch" },
  { label: "No Double Settlement", key: "checkNoDoubleSettlement" },
];

function ThreeWayMatchIcons({
  validation,
}: {
  readonly validation: ValidationResult | undefined;
}) {
  if (!validation) {
    return <span className="text-xs text-gray-400">--</span>;
  }
  const items = [
    { label: "Amount", key: "checkAmountMatch" as const },
    { label: "Identity", key: "checkInvestorMatch" as const },
    { label: "Reference", key: "checkReferenceMatch" as const },
  ];
  return (
    <div className="flex items-center gap-3">
      {items.map((item) => {
        const passed = validation.checks[item.key];
        return (
          <div key={item.key} className="flex items-center gap-1">
            {passed ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className="text-xs text-gray-600">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const StatusIcon = ({ s }: { readonly s: string }) => {
  if (s === "pass") return <CheckCircle className="h-4 w-4 text-green-600" />;
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

// ── Capital Calls Section ────────────────────────────────

function CapitalCallsSection({ fundId }: { readonly fundId: string }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    amountDue: "",
    dueDate: "",
    wireInstructions: "",
  });

  const { data: calls, isLoading } = useQuery({
    queryKey: QUERY_KEYS.capitalCalls(fundId),
    queryFn: () => getCapitalCalls(fundId).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createCapitalCall(fundId, {
        amountDue: formData.amountDue,
        dueDate: formData.dueDate,
        wireInstructions: formData.wireInstructions || undefined,
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success("Capital call created successfully");
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.capitalCalls(fundId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.subscriptions(fundId),
      });
      setDialogOpen(false);
      setFormData({ amountDue: "", dueDate: "", wireInstructions: "" });
    },
    onError: (error: Error) => {
      toast.error("Failed to create capital call: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  return (
    <SectionCard
      title="Capital Calls"
      action={
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Capital Call
        </button>
      }
      className="mb-6"
    >
      {isLoading ? (
        <div className="flex items-center gap-2 p-4 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading capital calls...
        </div>
      ) : !calls || calls.length === 0 ? (
        <EmptyState
          title="No capital calls"
          message="Create a capital call to request funds from investors."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Call #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Amount Due
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Due Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Wire Instructions
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call: CapitalCall) => (
                <tr
                  key={call.id}
                  className="border-b border-gray-100"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {call.callNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {fmt(Number(call.amountDue))}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(call.dueDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px]">
                    {call.wireInstructions ? (
                      <span
                        className="block truncate"
                        title={call.wireInstructions}
                      >
                        {call.wireInstructions}
                      </span>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <CapitalCallStatusBadge status={call.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>New Capital Call</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount Due
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={formData.amountDue}
                  onChange={(e) =>
                    setFormData({ ...formData, amountDue: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="1000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDate: e.target.value })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Wire Instructions
                </label>
                <textarea
                  rows={3}
                  value={formData.wireInstructions}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      wireInstructions: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Bank name, routing number, account number..."
                />
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
            </DialogFooter>
            {createMutation.isError && (
              <p className="mt-2 text-xs text-red-600">
                {(createMutation.error as Error).message}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

// ── Settlement Validation Section ────────────────────────

function SettlementValidationSection({
  fundId,
}: {
  readonly fundId: string;
}) {
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

  const selected =
    queue?.find((q) => q.id === selectedId) ?? queue?.[0] ?? null;

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

  if (isLoading)
    return (
      <div className="flex items-center gap-2 p-6 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settlement data...
      </div>
    );

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
    <>
      {!hasPending ? (
        <EmptyState
          title="No pending settlements"
          message="All subscriptions have been settled, or no subscriptions exist yet."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Payment Evidence Queue">
            <div className="space-y-2">
              {queue.map((p) => {
                const uploaded = uploadedFiles[p.id];
                const vResult = validationResults[p.id];
                const isMismatch =
                  vResult?.status === "FAILED";
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-md border border-border p-3 text-left transition-colors",
                      selected?.id === p.id
                        ? "bg-sidebar-accent border-primary/30"
                        : "hover:bg-muted",
                      isMismatch && "border-red-200 bg-red-50",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {p.investor}
                        </p>
                        {vResult && (
                          <ThreeWayMatchIcons validation={vResult} />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {p.amount} · {p.ref}
                      </p>
                      {uploaded && (
                        <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {uploaded.name}
                        </p>
                      )}
                      {isMismatch && (
                        <p className="text-xs text-red-600 mt-0.5">
                          {vResult.failureReasonCode ??
                            "Validation check failed"}
                        </p>
                      )}
                    </div>
                    <StatusBadge
                      status={
                        isMismatch ? "Failed" : p.status
                      }
                    />
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
                        <span className="text-sm text-gray-700">
                          {ci.label}
                        </span>
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
                    onClick={() =>
                      selected && validateMutation.mutate(selected)
                    }
                    disabled={
                      !hasPaymentDoc || validateMutation.isPending
                    }
                    className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {validateMutation.isPending
                      ? "Validating..."
                      : "Validate"}
                  </button>
                  <button
                    onClick={() => {
                      if (
                        selected &&
                        currentValidation?.settlementRecordId
                      ) {
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
    </>
  );
}

// ── Main Page ────────────────────────────────────────────

export default function SettlementPage() {
  const fundId = DEFAULT_FUND_CODE;

  return (
    <div>
      <PageHeader
        title="Settlement"
        subtitle="Manage capital calls and verify payment evidence against subscription terms"
      />

      <Tabs defaultValue="history" className="mt-2">
        <TabsList className="mb-4">
          <TabsTrigger value="history">Settlement History & Capital Calls</TabsTrigger>
          <TabsTrigger value="validation">Payment Evidence & Validation</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <CapitalCallsSection fundId={fundId} />
          <SettlementHistoryOnly fundId={fundId} />
        </TabsContent>

        <TabsContent value="validation">
          <SettlementValidationSection fundId={fundId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Settlement history table extracted for the first tab */
function SettlementHistoryOnly({ fundId }: { readonly fundId: string }) {
  const { data: settledSubs, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.subscriptions(fundId), "SETTLED"],
    queryFn: () => getSubscriptions(fundId, "SETTLED").then((r) => r.data),
  });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 p-6 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settlement history...
      </div>
    );

  if (!settledSubs || settledSubs.length === 0)
    return (
      <EmptyState
        title="No settled subscriptions"
        message="No subscriptions have been settled yet."
      />
    );

  return (
    <SectionCard title={`Settlement History (${settledSubs.length})`} className="mt-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">LP Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Committed Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Allocation</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Three-Way Match</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Settlement Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Verification</th>
            </tr>
          </thead>
          <tbody>
            {settledSubs.map((sub) => (
              <tr key={sub.subscriptionId} className="border-b border-gray-100">
                <td className="px-4 py-3 font-medium text-gray-900">{sub.investorName || sub.investorId}</td>
                <td className="px-4 py-3 text-gray-900">${Number(sub.committedAmount).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-900">{Number(sub.allocationPct)}%</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {["Amount", "Identity", "Reference"].map((label) => (
                      <div key={label} className="flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-xs text-gray-600">{label}</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3"><StatusBadge status="Settled" /></td>
                <td className="px-4 py-3 text-gray-600">{sub.settledAt ? new Date(sub.settledAt).toLocaleDateString() : "--"}</td>
                <td className="px-4 py-3">
                  {sub.settlementTxHash ? (
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs">Verified</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
