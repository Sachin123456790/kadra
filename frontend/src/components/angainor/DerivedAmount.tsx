import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Link } from "react-router-dom";
import { FileText, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DerivedAmount — hover/click popover that explains how a displayed monetary
 * value was calculated. Inputs (steps), formula, and optional source references
 * make every number verifiable without navigating away.
 *
 * Keyboard: Enter/Space opens popover, Escape closes. Radix handles focus trap.
 * Accessibility: aria-describedby auto-wired via Radix PopoverPrimitive.
 * Reduced motion: Radix data-state animations are skipped via prefers-reduced-motion
 * in Tailwind's motion-reduce: modifier.
 */

export type DerivationSourceKind =
  | "subscription"
  | "transfer"
  | "distribution"
  | "capital_call"
  | "document"
  | "settlement"
  | "wallet";

export interface DerivationSourceRef {
  readonly kind: DerivationSourceKind;
  readonly id: string;
  readonly label?: string;
  readonly route?: string;
}

export interface DerivationStep {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly formula?: string;
  readonly sourceRef?: DerivationSourceRef;
}

export interface DerivedAmountProps {
  readonly amount: React.ReactNode;
  readonly label?: string;
  readonly formula?: string;
  readonly steps: ReadonlyArray<DerivationStep>;
  readonly result: React.ReactNode;
  readonly asOf?: string | Date;
  readonly sourceDocumentRef?: {
    readonly id: string;
    readonly name: string;
    readonly route?: string;
  };
  readonly className?: string;
  readonly triggerClassName?: string;
}

function formatAsOf(asOf: string | Date): string {
  const d = typeof asOf === "string" ? new Date(asOf) : asOf;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DerivedAmount({
  amount,
  label,
  formula,
  steps,
  result,
  asOf,
  sourceDocumentRef,
  className,
  triggerClassName,
}: DerivedAmountProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className={cn(
            "inline cursor-help border-b border-dotted border-gray-400 bg-transparent p-0 text-inherit decoration-inherit outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:rounded-sm",
            triggerClassName,
          )}
          aria-label={
            label ? `${label} — click for calculation breakdown` : "Show calculation breakdown"
          }
        >
          {amount}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          side="top"
          sideOffset={6}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={cn(
            "z-50 w-[22rem] max-w-sm rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-900 shadow-lg outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "motion-reduce:animate-none motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none",
            className,
          )}
        >
          {label && (
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {label}
            </div>
          )}
          {formula && (
            <div className="mb-3 rounded border border-gray-100 bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-700">
              {formula}
            </div>
          )}

          {steps.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {steps.map((step, idx) => (
                <div
                  key={`${step.label}-${idx}`}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-700">{step.label}</div>
                    {step.formula && (
                      <div className="mt-0.5 font-mono text-[11px] text-gray-400">
                        {step.formula}
                      </div>
                    )}
                    {step.sourceRef?.route && (
                      <Link
                        to={step.sourceRef.route}
                        className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                      >
                        {step.sourceRef.label ??
                          `${step.sourceRef.kind}:${step.sourceRef.id.slice(0, 8)}`}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                    {step.sourceRef && !step.sourceRef.route && (
                      <div className="mt-0.5 font-mono text-[11px] text-gray-400">
                        {step.sourceRef.label ??
                          `${step.sourceRef.kind}:${step.sourceRef.id.slice(0, 8)}`}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right font-mono tabular-nums text-gray-900">
                    {step.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start justify-between gap-3 border-t border-gray-200 pt-2 text-xs">
            <div className="font-semibold text-gray-900">Result</div>
            <div className="shrink-0 text-right font-mono tabular-nums font-semibold text-gray-900">
              {result}
            </div>
          </div>

          {(asOf || sourceDocumentRef) && (
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-400">
              {asOf && <span>As of {formatAsOf(asOf)}</span>}
              {sourceDocumentRef && (
                sourceDocumentRef.route ? (
                  <Link
                    to={sourceDocumentRef.route}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    {sourceDocumentRef.name}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {sourceDocumentRef.name}
                  </span>
                )
              )}
            </div>
          )}
          <PopoverPrimitive.Arrow className="fill-white" width={10} height={5} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export default DerivedAmount;
