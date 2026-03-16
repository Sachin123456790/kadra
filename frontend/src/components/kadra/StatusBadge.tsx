import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "destructive" | "info" | "default";

const variantMap: Record<string, BadgeVariant> = {
  Verified: "success",
  Settled: "success",
  Success: "success",
  Completed: "success",
  Pending: "warning",
  Processing: "warning",
  Verifying: "info",
  Rejected: "destructive",
  Revoked: "destructive",
  Failed: "destructive",
  Passed: "success",
  MINT: "success",
  TRANSFER: "info",
};

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  default: "bg-muted text-muted-foreground",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

function resolveVariant(status: string): BadgeVariant {
  if (variantMap[status]) return variantMap[status];
  const lower = status.toLowerCase();
  if (lower.includes("verified") || lower.includes("settled") || lower.includes("completed") || lower.includes("minted") || lower.includes("deployed") || lower.includes("granted") || lower.includes("anchored")) return "success";
  if (lower.includes("pending") || lower.includes("issued") || lower.includes("attempted") || lower.includes("updated") || lower.includes("generated")) return "warning";
  if (lower.includes("failed") || lower.includes("rejected") || lower.includes("revoked")) return "destructive";
  if (lower.includes("created") || lower.includes("uploaded") || lower.includes("linked") || lower.includes("response") || lower.includes("sent")) return "info";
  return "default";
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = resolveVariant(status);
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-200 motion-reduce:transition-none", variantStyles[variant], className)}>
      {status}
    </span>
  );
}
