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
