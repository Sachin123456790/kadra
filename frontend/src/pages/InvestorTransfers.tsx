import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getMyTransfers } from "@/services";
import { validateTransfer, confirmTransfer } from "@/services/tokenization.service";
import { encodeTransfer } from "@/config/kadra-token-abi";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import { useWallet } from "@/hooks/useWallet";
import type { InvestorTransferRequest } from "@/services/investor-portal.service";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<InvestorTransferRequest>[] = [
  { key: "fromWalletAddress", header: "From", render: (r) => <ExplorerLink value={r.fromWalletAddress ?? ""} type="address" /> },
  { key: "toWalletAddress", header: "To", render: (r) => <ExplorerLink value={r.toWalletAddress ?? ""} type="address" /> },
  { key: "tokenAmount", header: "Amount", render: (r) => fmt(Number(r.tokenAmount)) },
  { key: "requestStatus", header: "Status", render: (r) => <StatusBadge status={r.requestStatus} /> },
  { key: "submittedTxHash", header: "Tx Hash", render: (r) => <ExplorerLink value={r.submittedTxHash ?? ""} type="tx" /> },
  { key: "createdAt", header: "Date", render: (r) => new Date(r.createdAt).toLocaleDateString() },
];

export default function InvestorTransfersPage() {
  const fundId = DEFAULT_FUND_CODE;
  const queryClient = useQueryClient();
  const wallet = useWallet();
  const [showForm, setShowForm] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [reason, setReason] = useState("");
  const [transferStep, setTransferStep] = useState<"idle" | "validating" | "signing" | "confirming" | "done" | "error">("idle");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorTransfers(fundId),
    queryFn: () => getMyTransfers(fundId).then((r) => r.data),
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      if (!wallet.address) throw new Error("Please connect your wallet first");

      // Step 1: Validate transfer (server-side pre-checks)
      setTransferStep("validating");
      const validation = await validateTransfer(fundId, {
        fromWalletAddress: wallet.address,
        toWalletAddress: toAddress,
        tokenAmount,
        reason: reason || undefined,
      });

      if (validation.data.requestStatus === "PRECHECK_FAILED") {
        const pc = validation.data.precheck;
        let msg = "Transfer pre-check failed: ";
        if (!pc.senderEligible) msg += "Your wallet is not eligible for this fund.";
        else if (!pc.recipientEligible) msg += "Recipient wallet is not eligible for this fund.";
        else if (!pc.sufficientBalance) msg += "Insufficient token balance.";
        throw new Error(msg);
      }

      // Step 2: Sign and submit transaction from investor's wallet
      setTransferStep("signing");
      const amount = BigInt(Math.round(parseFloat(tokenAmount) * 1e18));
      const calldata = encodeTransfer(toAddress, amount);

      const txHash = await wallet.sendTransaction({
        to: validation.data.contractAddress,
        data: calldata,
      });

      // Step 3: Confirm with backend (records the on-chain result)
      setTransferStep("confirming");
      const result = await confirmTransfer(validation.data.transferRequestId, txHash);
      setLastTxHash(result.data.txHash);

      return result;
    },
    onSuccess: () => {
      setTransferStep("done");
      setToAddress("");
      setTokenAmount("");
      setReason("");
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

  return (
    <div>
      <PageHeader
        title="My Transfers"
        subtitle="Transfer tokens to other eligible investors"
        action={
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              New Transfer
            </button>
          ) : undefined
        }
      />

      {showForm && (
        <SectionCard className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Initiate Transfer</h3>

          {/* Wallet connection status */}
          {wallet.status !== "connected" ? (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 mb-2">
                Connect your wallet to sign transfers. Your wallet must be linked to your investor account.
              </p>
              <button
                onClick={() => wallet.connectWallet()}
                className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
              >
                Connect Wallet
              </button>
              {wallet.error && <p className="text-xs text-red-600 mt-1">{wallet.error}</p>}
            </div>
          ) : (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm text-green-800">
                Connected: <code className="text-xs">{wallet.address}</code>
              </span>
            </div>
          )}

          {transferStep === "done" ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">Transfer submitted successfully!</p>
              {lastTxHash && (
                <p className="text-sm text-green-700 mt-1">
                  Tx: <ExplorerLink value={lastTxHash} type="tx" />
                </p>
              )}
              <button
                onClick={() => { resetForm(); setShowForm(false); }}
                className="mt-3 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Wallet Address</label>
                <input
                  type="text"
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={transferStep !== "idle"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Token Amount</label>
                <input
                  type="number"
                  value={tokenAmount}
                  onChange={(e) => setTokenAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={transferStep !== "idle"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. LP transfer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={transferStep !== "idle"}
                />
              </div>

              {transferError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{transferError}</p>
                  <button onClick={resetForm} className="text-xs text-red-600 underline mt-1">Try again</button>
                </div>
              )}

              {transferStep !== "idle" && transferStep !== "error" && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    {transferStep === "validating" && "Validating transfer eligibility..."}
                    {transferStep === "signing" && "Please sign the transaction in your wallet..."}
                    {transferStep === "confirming" && "Confirming on-chain transaction..."}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => transferMutation.mutate()}
                  disabled={!wallet.address || !toAddress || !tokenAmount || transferStep !== "idle"}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign & Transfer
                </button>
                <button
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                  disabled={transferStep !== "idle" && transferStep !== "error"}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {isLoading ? (
        <div className="p-6">Loading...</div>
      ) : error ? (
        <ErrorAlert title="Failed to load transfers" message={(error as Error).message} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No transfers" message="You have no transfer records yet." />
      ) : (
        <SectionCard>
          <DataTable columns={columns} data={data} getRowId={(r) => r.id} />
        </SectionCard>
      )}
    </div>
  );
}
