import { Inbox } from "lucide-react";
import type { ReactNode, ComponentType } from "react";

interface EmptyStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}

export function EmptyState({ title = "No data", message = "There's nothing to display yet.", action, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
