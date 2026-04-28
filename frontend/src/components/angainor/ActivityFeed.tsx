import { ExplorerLink } from "@/components/angainor/ExplorerLink";
import { formatEventType } from "@/lib/format";
import type { ActivityEvent } from "@/services/fund.service";

type BadgeColor = "gray" | "green" | "amber" | "red" | "blue";

const EVENT_COLOR_MAP: Record<string, BadgeColor> = {
  LPA_UPLOADED: "gray",
  SUBSCRIPTION_CREATED: "blue",
  SETTLEMENT_CONFIRMED: "green",
  TOKEN_MINTED: "green",
  TOKEN_DEPLOYED: "green",
  TRANSFER_REQUESTED: "amber",
  TRANSFER_EXECUTED: "gray",
  TRANSFER_FAILED: "red",
  CAPITAL_CALL_ISSUED: "amber",
  CAPITAL_CALL_STATUS_UPDATED: "blue",
  CAPITAL_CALL_RESPONSE_RECORDED: "blue",
  DISTRIBUTION_COMPLETED: "blue",
  NOTICE_GENERATED: "gray",
  NOTICE_SENT: "blue",
  DOCUMENT_UPLOADED: "gray",
  DOCUMENT_ANCHORED: "green",
  INVESTOR_CREATED: "blue",
  INVESTOR_VERIFICATION_UPDATED: "green",
  ELIGIBILITY_UPDATED: "green",
  WALLET_LINKED: "gray",
};

const BADGE_STYLES: Record<BadgeColor, string> = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-green-50 text-green-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  blue: "bg-blue-50 text-blue-700",
};

/* ── Relative time formatting ── */

function relativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/* ── Skeleton loader ── */

function SkeletonLine() {
  return (
    <div className="flex items-start gap-3 py-3 animate-pulse">
      <div className="h-5 w-28 rounded-full bg-border" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-3/4 rounded bg-border" />
        <div className="h-3 w-1/3 rounded bg-border" />
      </div>
    </div>
  );
}

/* ── Component ── */

export interface ActivityFeedProps {
  readonly events: readonly ActivityEvent[];
  readonly isLoading: boolean;
  readonly maxItems?: number;
  readonly showViewAll?: boolean;
  readonly viewAllLink?: string;
}

function buildDescription(event: ActivityEvent): string {
  const payload = event.payload ?? {};
  const parts: string[] = [];

  if (typeof payload.investorName === "string") {
    parts.push(payload.investorName);
  }
  if (typeof payload.amount === "number" || typeof payload.amount === "string") {
    const n = Number(payload.amount);
    if (!Number.isNaN(n)) {
      parts.push(
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(n),
      );
    }
  }
  if (typeof payload.description === "string") {
    parts.push(payload.description);
  }

  if (parts.length > 0) return parts.join(" - ");
  // Fallback: convert SNAKE_CASE aggregateType to Title Case
  return event.aggregateType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function ActivityFeed({
  events,
  isLoading,
  maxItems = 20,
  showViewAll = false,
  viewAllLink = "/audit",
}: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonLine key={i} />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No activity yet.
      </p>
    );
  }

  const displayed = Array.isArray(events) ? events.slice(0, maxItems) : [];

  return (
    <div>
      <ul className="divide-y divide-border">
        {displayed.map((event) => {
          const label = formatEventType(event.eventType);
          const color = EVENT_COLOR_MAP[event.eventType] ?? "gray";

          return (
            <li key={event.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span
                className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[color]}`}
              >
                {label}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">
                  {buildDescription(event)}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span title={new Date(event.occurredAt).toLocaleString()}>
                    {relativeTime(event.occurredAt)}
                  </span>
                  {event.txHash && (
                    <>
                      <span className="text-muted-foreground/50">|</span>
                      <ExplorerLink value={event.txHash} type="tx" />
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {showViewAll && events.length > maxItems && (
        <div className="mt-4 border-t border-border pt-3 text-center">
          <a
            href={viewAllLink}
            className="text-sm font-medium text-foreground hover:text-foreground"
          >
            View All
          </a>
        </div>
      )}
    </div>
  );
}
