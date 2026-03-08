import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getSubscriptions, requestPaymentValidation, confirmSettlement } from "@/services";
import type { ValidationResult } from "@/services/settlements.service";

const checkItems = [
  { label: "Amount Match", key: "checkAmountMatch" },
  { label: "Investor Match", key: "checkInvestorMatch" },
  { label: "Reference Match", key: "checkReferenceMatch" },
  { label: "No Double Settlement", key: "checkNoDoubleSettlement" },
];

const StatusIcon = ({ s }: { s: string }) => {
  if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (s === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Loader2 className="h-4 w-4 text-warning animate-spin" />;
};

interface QueueItem {
  id: string;
  subscriptionId: string;
  investor: string;
  investorId: string;
  amount: string;
  ref: string;
  status: string;
}

export default function SettlementPage() {
  const fundId = DEFAULT_FUND_CODE;
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const [paymentDocIds, setPaymentDocIds] = useState<Record<string, string>>({});

  // Fetch pending subscriptions as the payment queue
  const { data: queue, isLoading, error } = useQuery({
    queryKey: [...QUERY_KEYS.subscriptions(fundId), 'PENDING'],
    queryFn: () => getSubscriptions(fundId, 'PENDING').then(r => r.data),
    select: (data): QueueItem[] =>
      data.map((sub) => ({
        id: sub.subscriptionId,
        subscriptionId: sub.subscriptionId,
        investor: sub.investorName || sub.investorId,
        investorId: sub.investorId,
        amount: `$${Number(sub.committedAmount).toLocaleString()}`,
        ref: sub.subscriptionRef,
        status: sub.latestSettlementStatus ?? "Pending",
      })),
  });

  const selected = queue?.find(q => q.id === selectedId) ?? queue?.[0] ?? null;

  // Mutation: validate payment
  const validateMutation = useMutation({
    mutationFn: (item: QueueItem) =>
      requestPaymentValidation(item.subscriptionId, {
        paymentDocumentId: paymentDocIds[item.id] || '',
        declaredAmount: item.amount.replace(/[$,]/g, ''),
        declaredCurrency: 'USD',
        declaredReference: item.ref,
      }).then(r => r.data),
    onSuccess: (result, item) => {
      setValidationResults(prev => ({ ...prev, [item.id]: result }));
    },
  });

  // Mutation: confirm settlement
  const confirmMutation = useMutation({
    mutationFn: ({ subscriptionId, settlementRecordId }: { subscriptionId: string; settlementRecordId: string }) =>
      confirmSettlement(subscriptionId, settlementRecordId).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscriptions(fundId) });
    },
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load settlement queue" message={(error as Error).message} />;
  if (!queue || queue.length === 0) return <EmptyState title="No pending settlements" message="All subscriptions have been settled." />;

  const currentValidation = selected ? validationResults[selected.id] : null;

  return (
    <div>
      <PageHeader title="Settlement" subtitle="Verify payment evidence against subscription terms" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Payment Evidence Queue">
          <div className="space-y-2">
            {queue.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full flex items-center justify-between rounded-md border border-border p-3 text-left transition-colors",
                  selected?.id === p.id ? "bg-sidebar-accent border-primary/30" : "hover:bg-muted"
                )}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.investor}</p>
                  <p className="text-xs text-gray-500">{p.amount} · {p.ref}</p>
                </div>
                <StatusBadge status={p.status} />
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Validation Checklist">
          {selected && (
            <>
              {/* Payment Document Reference */}
              <div className="mb-4">
                <label htmlFor="paymentDocId" className="block text-sm font-medium text-gray-600 mb-1">
                  Payment Document ID
                </label>
                <input
                  id="paymentDocId"
                  type="text"
                  placeholder="Paste document reference or leave blank"
                  value={paymentDocIds[selected.id] || ''}
                  onChange={(e) =>
                    setPaymentDocIds(prev => ({ ...prev, [selected.id]: e.target.value }))
                  }
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {!paymentDocIds[selected.id] && (
                  <p className="mt-1 text-xs text-gray-500">
                    No document reference provided. Validation will proceed without it.
                  </p>
                )}
              </div>

              <div className="space-y-3 mb-4">
                {checkItems.map((ci) => {
                  let result: "pass" | "fail" | "pending" = "pending";
                  if (currentValidation) {
                    const checkValue = currentValidation.checks[ci.key as keyof typeof currentValidation.checks];
                    result = checkValue === true ? "pass" : checkValue === false ? "fail" : "pending";
                  }
                  return (
                    <div key={ci.key} className="flex items-center justify-between rounded-md border border-border p-3">
                      <span className="text-sm text-card-foreground">{ci.label}</span>
                      <div className="flex items-center gap-2">
                        <StatusIcon s={result} />
                        <span className="text-xs font-medium capitalize text-muted-foreground">{result}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {currentValidation?.status === "FAILED" && (
                <ErrorAlert
                  title="Validation Failed"
                  message={currentValidation.failureReasonCode ?? "One or more checks did not pass. Manual review required."}
                />
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => selected && validateMutation.mutate(selected)}
                  disabled={validateMutation.isPending}
                  className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {validateMutation.isPending ? "Validating..." : "Validate"}
                </button>
                <button
                  onClick={() => {
                    if (selected && currentValidation?.settlementRecordId) {
                      confirmMutation.mutate({
                        subscriptionId: selected.subscriptionId,
                        settlementRecordId: currentValidation.settlementRecordId,
                      });
                    }
                  }}
                  disabled={!currentValidation || currentValidation.status !== "PASSED" || confirmMutation.isPending}
                  className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {confirmMutation.isPending ? "Confirming..." : "Confirm Settlement"}
                </button>
              </div>

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
    </div>
  );
}
