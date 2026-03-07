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

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = variantMap[status] || "default";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variantStyles[variant], className)}>
      {status}
    </span>
  );
}
