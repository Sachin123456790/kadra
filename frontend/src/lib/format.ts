/**
 * Shared number formatting utilities.
 * Compact display: $15M, $5K, $1.2B — max 4-5 characters.
 */

const COMPACT_THRESHOLDS = [
  { value: 1_000_000_000, suffix: "B" },
  { value: 1_000_000, suffix: "M" },
  { value: 1_000, suffix: "K" },
] as const;

/** Format a number as compact USD: $15M, $5K, $250 */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  for (const { value, suffix } of COMPACT_THRESHOLDS) {
    if (abs >= value) {
      const scaled = n / value;
      const formatted =
        scaled % 1 === 0
          ? scaled.toFixed(0)
          : scaled.toFixed(1).replace(/\.0$/, "");
      return `$${formatted}${suffix}`;
    }
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Format a number as full USD: $15,000,000 */
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Truncate a hex hash/address to short form: 0x89cA...3a9B */
export function truncateHash(hash: string, prefixLen = 6, suffixLen = 4): string {
  if (!hash || hash.length <= prefixLen + suffixLen + 2) return hash;
  return `${hash.slice(0, prefixLen)}...${hash.slice(-suffixLen)}`;
}

/**
 * Human-readable labels for backend event types.
 * Unmapped keys fall through to formatEventType() which converts SNAKE_CASE → Title Case.
 */
const EVENT_LABELS: Record<string, string> = {
  LPA_UPLOADED: "LPA Uploaded",
  SUBSCRIPTION_CREATED: "Subscription Created",
  SETTLEMENT_CONFIRMED: "Settlement Verified",
  TOKEN_MINTED: "Tokens Minted",
  TRANSFER_REQUESTED: "Transfer Attempted",
  TRANSFER_EXECUTED: "Transfer Executed",
  TRANSFER_FAILED: "Transfer Failed",
  CAPITAL_CALL_ISSUED: "Capital Call Issued",
  CAPITAL_CALL_STATUS_UPDATED: "Capital Call Updated",
  CAPITAL_CALL_RESPONSE_RECORDED: "Capital Call Response",
  DISTRIBUTION_COMPLETED: "Distribution Completed",
  NOTICE_GENERATED: "Notice Generated",
  NOTICE_SENT: "Notice Sent",
  NOTICE_OPENED: "Notice Opened",
  NOTICE_DOWNLOADED: "Notice Downloaded",
  DOCUMENT_UPLOADED: "Document Uploaded",
  DOCUMENT_ANCHORED: "Document Anchored",
  INVESTOR_CREATED: "Investor Added",
  INVESTOR_VERIFICATION_UPDATED: "Verification Updated",
  ELIGIBILITY_UPDATED: "Eligibility Updated",
  WALLET_LINKED: "Wallet Linked",
  TOKEN_DEPLOYED: "Token Deployed",
  FUND_CREATED: "Fund Created",
  OWNERSHIP_SNAPSHOT: "Ownership Snapshot",
};

/** Convert a SNAKE_CASE event type to a human-readable label */
export function formatEventType(eventType: string): string {
  if (EVENT_LABELS[eventType]) return EVENT_LABELS[eventType];
  // Fallback: SNAKE_CASE → Title Case
  return eventType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
