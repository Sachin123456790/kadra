import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import {
  getFailedTransfers,
  getSuccessfulTransfers,
  getFundOverview,
} from "@/services";
import type { FailedTransfer, SuccessfulTransfer } from "@/services/tokenization.service";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import { Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────

const IDENTITY_REGISTRY_ADDRESS = "0x55822888507cac67bE5C11516e00C4597E7c78fb";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

function truncateHex(hex: string): string {
  if (!hex || hex.length <= 12) return hex || "--";
  return `${hex.slice(0, 6)}...${hex.slice(-4)}`;
}

function CopyButton({ value }: { readonly value: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value).catch(() => {
      /* silently fail in unsupported contexts */
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy to clipboard"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

// ── Unified Transfer Row ─────────────────────────────────

interface UnifiedTransfer {
  id: string;
  date: string;
  fromWallet: string;
  fromLpName: string;
  toWallet: string;
  toLpName: string;
  amount: number;
  preCheckResult: "Eligible" | "Not Eligible";
  onChainResult: "Executed" | "Reverted";
  txHash: string;
  timestamp: string;
  failureReason: string | null;
  isFailed: boolean;
}

function mergeTransfers(
  successful: SuccessfulTransfer[],
  failed: FailedTransfer[],
): UnifiedTransfer[] {
  const successRows: UnifiedTransfer[] = successful.map((t) => ({
    id: t.transferRequestId,
    date: t.timestamp,
    fromWallet: t.fromWalletAddress,
    fromLpName: "",
    toWallet: t.toWalletAddress,
    toLpName: "",
    amount: parseFloat(t.tokenAmount),
    preCheckResult: "Eligible",
    onChainResult: "Executed",
    txHash: t.txHash,
    timestamp: t.timestamp,
    failureReason: null,
    isFailed: false,
  }));

  const failedRows: UnifiedTransfer[] = failed.map((t) => ({
    id: t.transferRequestId,
    date: t.timestamp,
    fromWallet: t.fromWalletAddress,
    fromLpName: "",
    toWallet: t.toWalletAddress,
    toLpName: "",
    amount: parseFloat(t.tokenAmount),
    preCheckResult: "Not Eligible",
    onChainResult: "Reverted",
    txHash: "",
    timestamp: t.timestamp,
    failureReason: t.failureCode ? t.failureCode.replace(/_/g, " ") : null,
    isFailed: true,
  }));

  const all = [...successRows, ...failedRows];
  all.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return all;
}

// ── Transfer Rules Card ──────────────────────────────────

function TransferRulesCard({
  identityRegistryAddress,
  lpaHash,
}: {
  readonly identityRegistryAddress: string;
  readonly lpaHash: string;
}) {
  return (
    <SectionCard title="Transfer Rules" className="mb-6">
      <div className="rounded-lg bg-gray-50 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
              Transfer Restriction Type
            </p>
            <p className="text-sm font-medium text-gray-900">LP Only</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
              Identity Registry Address
            </p>
            <ExplorerLink
              value={identityRegistryAddress}
              type="address"
            />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
              Eligibility Marker Required
            </p>
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Yes
            </span>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
              Rules Derived From
            </p>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-gray-700">
                {truncateHex(lpaHash)}
              </span>
              {lpaHash && <CopyButton value={lpaHash} />}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Transfer History Table ───────────────────────────────

function TransferHistoryTable({
  transfers,
}: {
  readonly transfers: UnifiedTransfer[];
}) {
  if (transfers.length === 0) {
    return (
      <EmptyState
        title="No transfers"
        message="No transfer activity has been recorded yet."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              From Wallet
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              To Wallet
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Pre-Check
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              On-Chain Result
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Tx Hash
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Timestamp
            </th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => (
            <tr
              key={t.id}
              className={cn(
                "border-b border-gray-100",
                t.isFailed && "bg-red-50",
              )}
            >
              <td className="px-4 py-3 text-gray-900">
                {new Date(t.date).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <ExplorerLink value={t.fromWallet} type="address" />
              </td>
              <td className="px-4 py-3">
                <ExplorerLink value={t.toWallet} type="address" />
              </td>
              <td className="px-4 py-3 text-gray-900">{fmt(t.amount)}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    t.preCheckResult === "Eligible"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800",
                  )}
                >
                  {t.preCheckResult}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    t.onChainResult === "Executed"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800",
                  )}
                >
                  {t.onChainResult}
                </span>
              </td>
              <td className="px-4 py-3">
                {t.txHash ? (
                  <ExplorerLink value={t.txHash} type="tx" />
                ) : (
                  <span className="text-gray-400">--</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                <div>
                  {new Date(t.timestamp).toLocaleString()}
                </div>
                {t.failureReason && (
                  <p className="text-xs text-red-600 mt-0.5">
                    {t.failureReason}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────

export default function TransfersPage() {
  const fundId = DEFAULT_FUND_CODE;

  const {
    data: failedData,
    isLoading: failedLoading,
    error: failedError,
  } = useQuery({
    queryKey: QUERY_KEYS.failedTransfers(fundId),
    queryFn: () => getFailedTransfers(fundId).then((r) => r.data),
  });

  const {
    data: successData,
    isLoading: successLoading,
    error: successError,
  } = useQuery({
    queryKey: QUERY_KEYS.successfulTransfers(fundId),
    queryFn: () => getSuccessfulTransfers(fundId).then((r) => r.data),
  });

  const {
    data: fundOverview,
    isLoading: fundLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.fundOverview(fundId),
    queryFn: () => getFundOverview(fundId).then((r) => r.data),
  });

  const isLoading = failedLoading || successLoading || fundLoading;

  const transfers = useMemo(() => {
    const successful = successData ?? [];
    const failed = failedData ?? [];
    return mergeTransfers(successful, failed);
  }, [successData, failedData]);

  // Derive LPA hash from fund overview if available
  const lpaHash = fundOverview?.tokenContract?.contractAddress ?? "";

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Transfers"
          subtitle="Transfer rules enforcement and activity monitoring"
        />
        <div className="flex items-center gap-2 p-6 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading transfer data...
        </div>
      </div>
    );
  }

  if (failedError || successError) {
    return (
      <div>
        <PageHeader
          title="Transfers"
          subtitle="Transfer rules enforcement and activity monitoring"
        />
        <ErrorAlert
          title="Failed to load transfers"
          message={
            ((failedError || successError) as Error).message
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Transfers"
        subtitle="Transfer rules enforcement and activity monitoring"
      />

      <TransferRulesCard
        identityRegistryAddress={IDENTITY_REGISTRY_ADDRESS}
        lpaHash={lpaHash}
      />

      <SectionCard title={`Transfer History (${transfers.length})`}>
        <TransferHistoryTable transfers={transfers} />
      </SectionCard>
    </div>
  );
}
