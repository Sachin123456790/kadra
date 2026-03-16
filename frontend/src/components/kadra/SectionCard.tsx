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
    <div className={cn("rounded-lg border border-border bg-card transition-shadow duration-200 hover:shadow-sm motion-reduce:transition-none", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          {title && <h3 className="text-lg font-semibold text-card-foreground">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
