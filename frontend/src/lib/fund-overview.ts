import type { CapitalCall } from "@/services/capital-calls.service";

/** Missing records remain unknown; a recorded zero is a valid value. */
export function recordedAmount(
  value: string | number | null | undefined,
): number | null {
  if (value == null || (typeof value === "string" && value.trim() === ""))
    return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function issuedCapital(calls: CapitalCall[] | undefined): number | null {
  if (!calls) return null;
  const issued = calls.filter((call) =>
    ["ISSUED", "PARTIALLY_RECEIVED", "CLOSED", "COMPLETED"].includes(
      call.status,
    ),
  );
  const amounts = issued.map((call) => recordedAmount(call.amountDue));
  return amounts.some((amount) => amount === null)
    ? null
    : amounts.reduce<number>((sum, amount) => sum + amount!, 0);
}

export function displayMoney(value: number | null): string {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(value);
}
