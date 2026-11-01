import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SectionCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function SectionCard({ title, children, className, action }: SectionCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card shadow-sm", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          {title && <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
