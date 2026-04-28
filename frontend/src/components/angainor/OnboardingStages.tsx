import { Check, AlertCircle, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type {
  OnboardingStage,
  OnboardingStageKey,
  OnboardingSummary,
} from "@/services/investors.service";

interface OnboardingStagesProps {
  summary: OnboardingSummary;
  mode: "investor" | "admin";
  actions?: Partial<
    Record<
      OnboardingStageKey,
      {
        label: string;
        onClick: () => void;
        disabled?: boolean;
        loading?: boolean;
      }
    >
  >;
}

const ACTOR_LABEL: Record<OnboardingStage["actor"], string> = {
  investor: "Investor",
  admin: "Admin",
  system: "System",
};

const STATE_STYLE: Record<
  OnboardingStage["state"],
  { dot: string; label: string }
> = {
  complete: {
    dot: "bg-green-100 text-green-700 border-green-200",
    label: "text-foreground",
  },
  current: {
    dot: "bg-blue-100 text-blue-700 border-blue-300 ring-2 ring-blue-200/60",
    label: "text-foreground font-semibold",
  },
  pending: {
    dot: "bg-gray-50 text-gray-400 border-gray-200",
    label: "text-muted-foreground",
  },
  blocked: {
    dot: "bg-red-100 text-red-700 border-red-200",
    label: "text-red-700 font-semibold",
  },
};

function StateIcon({ stage }: { stage: OnboardingStage }) {
  if (stage.state === "complete") return <Check className="h-3.5 w-3.5" />;
  if (stage.state === "blocked")
    return <AlertCircle className="h-3.5 w-3.5" />;
  if (stage.state === "current") return <Loader2 className="h-3.5 w-3.5" />;
  return <Circle className="h-3 w-3" />;
}

export function OnboardingStages({
  summary,
  mode,
  actions,
}: OnboardingStagesProps) {
  const stuckStage = summary.blockedOn
    ? summary.stages.find((s) => s.key === summary.blockedOn)
    : null;

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3",
          summary.completed
            ? "bg-green-50 border-green-200 text-green-900"
            : "bg-amber-50 border-amber-200 text-amber-900",
        )}
      >
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            summary.completed
              ? "bg-green-200 text-green-800"
              : "bg-amber-200 text-amber-800",
          )}
        >
          {summary.completed ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">
            {summary.completed
              ? "Fully onboarded"
              : `Stuck on: ${stuckStage?.label ?? "—"}`}
          </div>
          <div className="text-xs opacity-80">
            {summary.completed
              ? "All 6 onboarding steps complete"
              : `Waiting on ${stuckStage ? ACTOR_LABEL[stuckStage.actor] : "investor"} — ${summary.percentComplete}% complete`}
          </div>
        </div>
        <div className="text-2xl font-bold tabular-nums">
          {summary.percentComplete}%
        </div>
      </div>

      {/* Vertical stepper */}
      <ol className="space-y-3">
        {summary.stages.map((stage, idx) => {
          const style = STATE_STYLE[stage.state];
          const action = actions?.[stage.key];
          const isLast = idx === summary.stages.length - 1;
          return (
            <li key={stage.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border",
                    style.dot,
                  )}
                >
                  <StateIcon stage={stage} />
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "mt-1 w-px flex-1 min-h-[20px]",
                      stage.state === "complete"
                        ? "bg-green-200"
                        : "bg-gray-200",
                    )}
                  />
                )}
              </div>

              <div className="flex-1 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={cn("text-sm", style.label)}>
                      <span className="mr-2 text-muted-foreground font-mono text-xs">
                        §{String(stage.order).padStart(2, "0")}
                      </span>
                      {stage.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {mode === "admin"
                        ? `${ACTOR_LABEL[stage.actor]} action`
                        : stage.actor === "investor"
                          ? "You"
                          : ACTOR_LABEL[stage.actor]}
                      {stage.state === "complete" && " • Done"}
                      {stage.state === "current" && " • In progress"}
                      {stage.state === "pending" && " • Pending"}
                    </div>
                  </div>

                  {action && stage.state !== "complete" && (
                    <Button
                      size="sm"
                      variant={stage.state === "current" ? "default" : "outline"}
                      disabled={action.disabled || action.loading}
                      onClick={action.onClick}
                    >
                      {action.loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        action.label
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
