import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import {
  getFailedTransfers,
  getSuccessfulTransfers,
  getDocuments,
  getInvestors,
} from "@/services";
import type { FailedTransfer, SuccessfulTransfer } from "@/services/tokenization.service";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { TableSkeleton } from "@/components/kadra/Skeleton";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import { HashDisplay } from "@/components/kadra/HashDisplay";
import { TechnicalDetails } from "@/components/kadra/TechnicalDetails";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHighlightRow } from "@/hooks/useHighlightRow";

// ── Constants ────────────────────────────────────────────

const IDENTITY_REGISTRY_ADDRESS = "0x55822888507cac67bE5C11516e00C4597E7c78fb";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

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

function buildWalletToNameMap(
  investors: Array<{ legalName: string; wallets: Array<{ address: string }> }> | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!investors) return map;
  for (const inv of investors) {
    for (const w of inv.wallets) {
      map.set(w.address.toLowerCase(), inv.legalName);
    }
  }
  return map;
}

function mergeTransfers(
  successful: SuccessfulTransfer[],
  failed: FailedTransfer[],
  walletNameMap: Map<string, string>,
): UnifiedTransfer[] {
  const lookupName = (addr: string) => walletNameMap.get(addr.toLowerCase()) ?? "";

  const successRows: UnifiedTransfer[] = successful.map((t) => ({
    id: t.transferRequestId,
    date: t.timestamp,
    fromWallet: t.fromWalletAddress,
    fromLpName: lookupName(t.fromWalletAddress),
    toWallet: t.toWalletAddress,
    toLpName: lookupName(t.toWalletAddress),
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
    fromLpName: lookupName(t.fromWalletAddress),
    toWallet: t.toWalletAddress,
    toLpName: lookupName(t.toWalletAddress),
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
      <div className="rounded-lg bg-muted p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Transfer Restriction Type
            </p>
            <p className="text-sm font-medium text-foreground">LP Only</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Eligibility Required
            </p>
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Yes
            </span>
          </div>
        </div>
      </div>
      <TechnicalDetails label="Blockchain Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Identity Registry
            </p>
            <ExplorerLink
              value={identityRegistryAddress}
              type="address"
            />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Rules Derived From
            </p>
            <HashDisplay value={lpaHash} />
          </div>
        </div>
      </TechnicalDetails>
    </SectionCard>
  );
}

// ── Transfer History Table ───────────────────────────────

function TransferHistoryTable({
  transfers,
  highlightId,
  isPulsing,
}: {
  readonly transfers: UnifiedTransfer[];
  readonly highlightId: string | null;
  readonly isPulsing: boolean;
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
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              From
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              To
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Eligibility
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Result
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => {
            const isHighlighted = highlightId === t.id;
            return (
            <tr
              key={t.id}
              data-highlight-id={t.id}
              className={cn(
                "border-b border-border",
                t.isFailed && "bg-red-50",
                isHighlighted && "bg-indigo-50",
                isHighlighted && isPulsing && "animate-pulse",
              )}
            >
              <td className="px-4 py-3 text-foreground">
                {new Date(t.date).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {t.fromLpName || <HashDisplay value={t.fromWallet} />}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {t.toLpName || <HashDisplay value={t.toWallet} />}
              </td>
              <td className="px-4 py-3 text-foreground">{fmt(t.amount)}</td>
              <td className="px-4 py-3">
                {t.preCheckResult === "Eligible" ? (
                  <span className="inline-flex items-center gap-1 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs">Eligible</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" />
                    <span className="text-xs">Not Eligible</span>
                  </span>
                )}
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
                  {t.onChainResult === "Executed" ? "Completed" : "Rejected"}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                <div>{new Date(t.timestamp).toLocaleString()}</div>
                {t.failureReason && (
                  <p className="text-xs text-red-600 mt-0.5">
                    {t.failureReason}
                  </p>
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Transfer Notices Section ────────────────────────────────

interface TransferNotice {
  id: string;
  dateTime: string;
  lpName: string;
  transferType: "Completed" | "Blocked" | "Initiated";
  amount: number;
  counterparty: string;
  status: string;
}

function deriveNotices(transfers: UnifiedTransfer[]): TransferNotice[] {
  return transfers.map((t) => {
    let transferType: TransferNotice["transferType"] = "Initiated";
    if (t.onChainResult === "Executed") {
      transferType = "Completed";
    } else if (t.isFailed) {
      transferType = "Blocked";
    }

    return {
      id: t.id,
      dateTime: t.timestamp,
      lpName: t.fromLpName || t.fromWallet.slice(0, 10) + "...",
      transferType,
      amount: t.amount,
      counterparty: t.toLpName || t.toWallet.slice(0, 10) + "...",
      status: t.onChainResult === "Executed" ? "Settled" : t.isFailed ? "Rejected" : "Pending",
    };
  });
}

const TRANSFER_TYPE_BADGE_CLASSES: Record<TransferNotice["transferType"], string> = {
  Completed: "bg-green-100 text-green-800",
  Blocked: "bg-red-100 text-red-800",
  Initiated: "bg-blue-100 text-blue-800",
};

function TransferNoticesSection({
  transfers,
}: {
  readonly transfers: UnifiedTransfer[];
}) {
  const notices = deriveNotices(transfers);

  if (notices.length === 0) return null;

  return (
    <SectionCard title={`Transfer Notices (${notices.length})`} className="mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Date/Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">LP Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Transfer Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Counterparty</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground" />
            </tr>
          </thead>
          <tbody>
            {notices.map((notice) => (
              <tr key={notice.id} className="border-b border-border">
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {new Date(notice.dateTime).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{notice.lpName}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      TRANSFER_TYPE_BADGE_CLASSES[notice.transferType],
                    )}
                  >
                    {notice.transferType}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground">{fmt(notice.amount)}</td>
                <td className="px-4 py-3 text-foreground">{notice.counterparty}</td>
                <td className="px-4 py-3 text-muted-foreground">{notice.status}</td>
                <td className="px-4 py-3">
                  <a
                    href="#transfer-history"
                    onClick={(e) => {
                      e.preventDefault();
                      const historySection = document.querySelector('[data-section="transfer-history"]');
                      historySection?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-xs font-medium text-primary hover:text-foreground transition-colors"
                  >
                    View Record
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ── Main Page ────────────────────────────────────────────

export default function TransfersPage() {
  const fundId = DEFAULT_FUND_CODE;
  const { highlightId, isPulsing } = useHighlightRow();

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
    data: documents,
    isLoading: docsLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.documents(fundId),
    queryFn: () => getDocuments(fundId).then((r) => r.data),
  });

  const {
    data: investors,
    isLoading: investorsLoading,
  } = useQuery({
    queryKey: QUERY_KEYS.investors(fundId),
    queryFn: () => getInvestors(fundId).then((r) => r.data),
  });

  const isLoading = failedLoading || successLoading || docsLoading || investorsLoading;

  const walletNameMap = useMemo(() => buildWalletToNameMap(investors), [investors]);

  const transfers = useMemo(() => {
    const successful = successData ?? [];
    const failed = failedData ?? [];
    return mergeTransfers(successful, failed, walletNameMap);
  }, [successData, failedData, walletNameMap]);

  // Derive LPA hash from the first MASTER_LPA governing document
  const lpaHash = useMemo(() => {
    const lpaDoc = (documents ?? []).find((d) => d.documentType === "MASTER_LPA");
    return lpaDoc?.hash?.hashHex ?? "";
  }, [documents]);

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Transfers"
          subtitle="View transfer rules, eligibility checks, and activity history"
        />
        <div className="p-6 space-y-6">
          <TableSkeleton rows={5} columns={7} />
        </div>
      </div>
    );
  }

  if (failedError || successError) {
    return (
      <div>
        <PageHeader
          title="Transfers"
          subtitle="View transfer rules, eligibility checks, and activity history"
        />
        <ErrorAlert
          title="Unable to load transfer history"
          message={`${((failedError || successError) as Error).message}. Try refreshing the page.`}
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

      <TransferNoticesSection transfers={transfers} />

      <div data-section="transfer-history">
        <SectionCard title={`Transfer History (${transfers.length})`}>
          <TransferHistoryTable transfers={transfers} highlightId={highlightId} isPulsing={isPulsing} />
        </SectionCard>
      </div>
    </div>
  );
}
