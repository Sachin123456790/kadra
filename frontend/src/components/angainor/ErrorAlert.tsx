import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorAlertProps {
  title: string;
  message: string;
  className?: string;
}

export function ErrorAlert({ title, message, className }: ErrorAlertProps) {
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4", className)}>
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-destructive">{title}</p>
        <p className="text-xs text-destructive/80 mt-0.5">{message}</p>
      </div>
    </div>
  );
}
