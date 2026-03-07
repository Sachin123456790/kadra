import { useState } from "react";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const paymentQueue = [
  { id: "pmt-1", investor: "BlackRock Capital Partners", amount: "$21,375,000", ref: "WR-2025-001", status: "Passed" as const },
  { id: "pmt-2", investor: "Meridian Wealth Holdings", amount: "$13,650,000", ref: "WR-2025-002", status: "Verifying" as const },
  { id: "pmt-3", investor: "Pacific Rim Advisors LLC", amount: "$16,575,000", ref: "WR-2025-003", status: "Failed" as const },
];

const checkItems = [
  { label: "Amount Match", key: "amount" },
  { label: "Investor Match", key: "investor" },
  { label: "Reference Match", key: "reference" },
  { label: "Hash Match", key: "hash" },
];

const checkResults: Record<string, Record<string, "pass" | "fail" | "pending">> = {
  "pmt-1": { amount: "pass", investor: "pass", reference: "pass", hash: "pass" },
  "pmt-2": { amount: "pending", investor: "pending", reference: "pending", hash: "pending" },
  "pmt-3": { amount: "pass", investor: "pass", reference: "fail", hash: "fail" },
};

const StatusIcon = ({ s }: { s: string }) => {
  if (s === "pass") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (s === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Loader2 className="h-4 w-4 text-warning animate-spin" />;
};

export default function SettlementPage() {
  const [selected, setSelected] = useState(paymentQueue[0]);

  return (
    <div>
      <PageHeader title="Settlement" subtitle="Verify payment evidence against subscription terms" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Payment Evidence Queue">
          <div className="space-y-2">
            {paymentQueue.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={cn(
                  "w-full flex items-center justify-between rounded-md border border-border p-3 text-left transition-colors",
                  selected.id === p.id ? "bg-sidebar-accent border-primary/30" : "hover:bg-muted"
                )}
              >
                <div>
                  <p className="text-sm font-medium text-card-foreground">{p.investor}</p>
                  <p className="text-xs text-muted-foreground">{p.amount} · {p.ref}</p>
                </div>
                <StatusBadge status={p.status} />
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Validation Checklist">
          <div className="space-y-3 mb-4">
            {checkItems.map((ci) => {
              const result = checkResults[selected.id]?.[ci.key] || "pending";
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
          {selected.status === "Failed" && (
            <ErrorAlert title="Validation Failed" message="Reference and hash do not match the expected values. Manual review required." />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
