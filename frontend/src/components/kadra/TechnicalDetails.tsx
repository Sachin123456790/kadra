import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TechnicalDetailsProps {
  label?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Reusable expandable section for hiding blockchain / technical details.
 * Used across all pages to keep surface-level UI clean and non-crypto.
 */
export function TechnicalDetails({
  label = "Advanced Details",
  children,
  defaultOpen = false,
  className,
}: TechnicalDetailsProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("border-t border-border", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
      >
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {label}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
