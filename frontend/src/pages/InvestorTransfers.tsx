import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getMyTransfers, getMyDashboard, getInvestorCapTable } from "@/services";
import { getMyProfile } from "@/services/wallet-profile.service";
import { validateTransfer, confirmTransfer } from "@/services/tokenization.service";
import { encodeTransfer } from "@/config/kadra-token-abi";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import { TechnicalDetails } from "@/components/kadra/TechnicalDetails";
import { useWallet } from "@/hooks/useWallet";
import type { InvestorTransferRequest } from "@/services/investor-portal.service";
import { Shield, Search, AlertCircle, CheckCircle } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);

// ── Section 1: Transfer Eligibility ─────────────────────────

function TransferEligibilityPanel() {
  const fundId = DEFAULT_FUND_CODE;

  const { data: profile } = useQuery({
    queryKey: QUERY_KEYS.investorProfile(),
    queryFn: () => getMyProfile().then((r) => r.data),
  });

  const { data: dashboard } = useQuery({
    queryKey: QUERY_KEYS.investorDashboard(fundId),
    queryFn: () => getMyDashboard(fundId).then((r) => r.data),
  });

  const isVerified = profile?.verificationStatus === "VERIFIED";
  const eligibility = dashboard?.eligibility?.[0];
  const isEligible = eligibility?.eligibilityStatus === "ELIGIBLE";

  const badgeStyle = (active: boolean) =>
    active
      ? "bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
      : "bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground";

  return (
    <SectionCard title="Transfer Eligibility">
      <div className="bg-muted rounded-lg p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Transfer Eligibility</span>
            <span className={`inline-flex items-center rounded-full ${badgeStyle(isEligible)}`}>
              {isEligible ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Fund Membership</span>
            <span className={`inline-flex items-center rounded-full ${badgeStyle(isEligible)}`}>
              {isEligible ? "Verified" : "Pending"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">KYC Status</span>
            <span className={`inline-flex items-center rounded-full ${badgeStyle(isVerified)}`}>
              {isVerified ? "Verified" : "Pending"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Accreditation Status</span>
            <span className={`inline-flex items-center rounded-full ${badgeStyle(isVerified)}`}>
              {isVerified ? "Accredited" : "Pending"}
            </span>
          </div>
        </div>
        <div className="flex items-start gap-2 pt-3 border-t border-border">
          <Shield className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Transfers are permitted only to verified investors who are eligible members of this fund.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Section 2: Initiate Transfer ────────────────────────────

interface RecipientSearch {
  email: string;
  name: string;
  eligible: boolean;
}

function InitiateTransferSection({
  walletAddress,
  tokenBalance,
}: {
  walletAddress: string | null;
  tokenBalance: string;
}) {
  const fundId = DEFAULT_FUND_CODE;
  const queryClient = useQueryClient();
  const wallet = useWallet();

  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientResult, setRecipientResult] = useState<RecipientSearch | null>(null);
  const [tokenAmount, setTokenAmount] = useState("");
  const [transferStep, setTransferStep] = useState<
    "idle" | "validating" | "signing" | "confirming" | "done" | "error"
  >("idle");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRecipientSearch = useCallback((email: string) => {
    setRecipientEmail(email);
    setRecipientResult(null);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (email.length < 3) return;

    // Simulate a recipient lookup with debounce
    searchTimeout.current = setTimeout(() => {
      // For demo: any valid-looking email is treated as eligible
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (isValidEmail) {
        setRecipientResult({
          email,
          name: email.split("@")[0].replace(/[^a-zA-Z]/g, " "),
          eligible: true,
        });
      }
    }, 500);
  }, []);

  const transferMutation = useMutation({
    mutationFn: async () => {
      const activeAddr = wallet.address ?? walletAddress;
      if (!activeAddr) throw new Error("Please connect your wallet first");

      // Step 1: Validate
      setTransferStep("validating");
      const validation = await validateTransfer(fundId, {
        fromWalletAddress: activeAddr,
        toWalletAddress: recipientEmail, // Backend resolves email -> wallet
        tokenAmount,
      });

      if (validation.data.requestStatus === "PRECHECK_FAILED") {
        const pc = validation.data.precheck;
        let msg = "Transfer pre-check failed: ";
        if (!pc.senderEligible) msg += "Your wallet is not eligible for this fund.";
        else if (!pc.recipientEligible) msg += "Recipient is not eligible for this fund.";
        else if (!pc.sufficientBalance) msg += "Insufficient token balance.";
        throw new Error(msg);
      }

      // Step 2: Sign
      setTransferStep("signing");
      const amount = BigInt(Math.round(parseFloat(tokenAmount) * 1e18));
      const calldata = encodeTransfer(validation.data.precheck.recipientEligible ? recipientEmail : "", amount);

      const txHash = await wallet.sendTransaction({
        to: validation.data.contractAddress,
        data: calldata,
      });

      // Step 3: Confirm
      setTransferStep("confirming");
      const result = await confirmTransfer(validation.data.transferRequestId, txHash);
      setLastTxHash(result.data.txHash);
      return result;
    },
    onSuccess: () => {
      setTransferStep("done");
      setRecipientEmail("");
      setRecipientResult(null);
      setTokenAmount("");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.investorTransfers(fundId) });
    },
    onError: (err: Error) => {
      setTransferStep("error");
      setTransferError(err.message);
    },
  });

  const resetForm = () => {
    setTransferStep("idle");
    setTransferError(null);
    setLastTxHash(null);
  };

  const isReady = wallet.address && recipientEmail && tokenAmount && transferStep === "idle";

  return (
    <SectionCard title="Initiate Transfer">
      {/* Wallet connection status (simplified) */}
      {wallet.status !== "connected" ? (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 bg-amber-400 rounded-full" />
          <span className="text-sm text-amber-800">Account not connected</span>
          <button
            onClick={() => wallet.connectWallet()}
            className="ml-auto px-3 py-1 bg-amber-600 text-white rounded text-xs hover:bg-amber-700"
          >
            Connect
          </button>
          {wallet.error && <p className="text-xs text-red-600 mt-1">{wallet.error}</p>}
        </div>
      ) : (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-sm text-green-800">Wallet: Connected</span>
        </div>
      )}

      {transferStep === "done" ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <p className="text-green-800 font-medium">Transfer submitted successfully.</p>
          </div>
          {lastTxHash && (
            <TechnicalDetails label="Transaction Details">
              <p className="text-sm text-green-700">
                Tx: <ExplorerLink value={lastTxHash} type="tx" />
              </p>
            </TechnicalDetails>
          )}
          <button
            onClick={() => { resetForm(); }}
            className="mt-3 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recipient panel */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Recipient</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">LP Email Address</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={recipientEmail}
                    onChange={(e) => handleRecipientSearch(e.target.value)}
                    placeholder="Search by email..."
                    className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={transferStep !== "idle"}
                  />
                </div>
              </div>
              {recipientResult && (
                <div className={`p-3 rounded-lg border ${recipientResult.eligible ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <div className="flex items-center gap-2">
                    {recipientResult.eligible ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-sm ${recipientResult.eligible ? "text-green-800" : "text-red-800"}`}>
                      {recipientResult.eligible
                        ? "Recipient is eligible for this fund"
                        : "Recipient is NOT eligible for this fund"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Amount panel */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Amount</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Transfer Amount</label>
                <input
                  type="number"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={transferStep !== "idle"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Current allocation: {tokenBalance} units
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {transferError && transferStep === "error" && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{transferError}</p>
          <button onClick={resetForm} className="text-xs text-red-600 underline mt-1">Try again</button>
        </div>
      )}

      {/* Progress state */}
      {transferStep !== "idle" && transferStep !== "error" && transferStep !== "done" && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            {transferStep === "validating" && "Validating transfer eligibility..."}
            {transferStep === "signing" && "Processing transfer..."}
            {transferStep === "confirming" && "Confirming transfer..."}
          </p>
        </div>
      )}

      {/* Transfer button */}
      {transferStep !== "done" && (
        <div className="mt-4">
          <button
            onClick={() => transferMutation.mutate()}
            disabled={!isReady || (recipientResult !== null && !recipientResult.eligible)}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Transfer
          </button>
        </div>
      )}
    </SectionCard>
  );
}

// ── Section 3: Transfer History ─────────────────────────────

function TransferHistorySection({
  transfers,
  investorWalletAddress,
  walletNameMap,
}: {
  transfers: InvestorTransferRequest[];
  investorWalletAddress: string | null;
  walletNameMap: Record<string, string>;
}) {
  const getDirection = (t: InvestorTransferRequest): "Sent" | "Received" => {
    if (!investorWalletAddress) return "Sent";
    return t.fromWalletAddress?.toLowerCase() === investorWalletAddress.toLowerCase()
      ? "Sent"
      : "Received";
  };

  const getCounterparty = (t: InvestorTransferRequest): string => {
    const direction = getDirection(t);
    return direction === "Sent" ? (t.toWalletAddress ?? "--") : (t.fromWalletAddress ?? "--");
  };

  const getCounterpartyName = (t: InvestorTransferRequest): string | null => {
    const addr = getCounterparty(t);
    if (addr === "--") return null;
    return walletNameMap[addr.toLowerCase()] ?? null;
  };

  const isBlocked = (t: InvestorTransferRequest): boolean => {
    const status = t.requestStatus?.toLowerCase() ?? "";
    return status.includes("fail") || status.includes("block") || status.includes("reject");
  };

  const isExecuted = (t: InvestorTransferRequest): boolean => {
    const status = t.requestStatus?.toLowerCase() ?? "";
    return status.includes("success") || status.includes("confirm") || status.includes("complete") || status.includes("finalized");
  };

  return (
    <SectionCard title="Transfer History">
      {transfers.length === 0 ? (
        <EmptyState title="No transfers" message="You have no transfer records yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Direction</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Counterparty</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Result</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Reason</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => {
                const direction = getDirection(t);
                const blocked = isBlocked(t);
                const executed = isExecuted(t);
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-border ${blocked ? "bg-red-50" : ""}`}
                  >
                    <td className="px-4 py-3 text-foreground">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          direction === "Sent"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {direction}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="block text-sm font-medium text-foreground">
                          {getCounterpartyName(t) || "LP Investor"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {fmt(Number(t.tokenAmount))}
                    </td>
                    <td className="px-4 py-3">
                      {blocked ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                          Blocked
                        </span>
                      ) : executed ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Executed
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                          {t.requestStatus}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {blocked ? (t.precheckReasonText || t.precheckReasonCode || "Eligibility check failed") : "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ── Main Page Component ──────────────────────────────────────

export default function InvestorTransfersPage() {
  const fundId = DEFAULT_FUND_CODE;

  const { data: transfers, isLoading: transfersLoading, error: transfersError } = useQuery({
    queryKey: QUERY_KEYS.investorTransfers(fundId),
    queryFn: () => getMyTransfers(fundId).then((r) => r.data),
  });

  const { data: dashboard } = useQuery({
    queryKey: QUERY_KEYS.investorDashboard(fundId),
    queryFn: () => getMyDashboard(fundId).then((r) => r.data),
  });

  const { data: capTable } = useQuery({
    queryKey: QUERY_KEYS.investorCapTable(fundId),
    queryFn: () => getInvestorCapTable(fundId).then((r) => r.data),
  });

  const walletNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (capTable?.rows) {
      for (const row of capTable.rows) {
        if (row.investorName && row.walletAddress) {
          map[row.walletAddress.toLowerCase()] = row.investorName;
        }
      }
    }
    return map;
  }, [capTable]);

  const investorWalletAddress = useMemo(() => {
    if (!dashboard?.wallets?.length) return null;
    const primary = dashboard.wallets.find((w) => w.isPrimary);
    return primary?.address ?? dashboard.wallets[0]?.address ?? null;
  }, [dashboard]);

  const tokenBalance = useMemo(() => {
    return dashboard?.summary?.tokenBalance ?? "0";
  }, [dashboard]);

  if (transfersLoading) return <div className="p-6">Loading...</div>;
  if (transfersError) return <ErrorAlert title="Failed to load transfers" message={(transfersError as Error).message} />;

  return (
    <div>
      <PageHeader
        title="My Transfers"
        subtitle="Transfer ownership to other eligible investors"
      />

      <div className="space-y-6">
        {/* Section 1: Transfer Eligibility */}
        <TransferEligibilityPanel />

        {/* Section 2: Initiate Transfer */}
        <InitiateTransferSection
          walletAddress={investorWalletAddress}
          tokenBalance={tokenBalance}
        />

        {/* Section 3: Transfer History */}
        <TransferHistorySection
          transfers={transfers ?? []}
          investorWalletAddress={investorWalletAddress}
          walletNameMap={walletNameMap}
        />
      </div>
    </div>
  );
}
