import { cn } from "@/lib/utils";

interface KadraTabsProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}

export function KadraTabs({ tabs, active, onChange }: KadraTabsProps) {
  return (
    <div className="flex gap-1 border-b border-border mb-6">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors rounded-t-md",
            active === tab
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
