"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface LogEntry {
  timestamp: string;
  step: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

interface CapTableRow {
  investorId: string;
  name: string;
  walletAddress: string;
  tokenBalance: string;
  ownershipPercent: number;
  status: string;
  eligible: boolean;
}

interface ContractAddresses {
  identityRegistry: string | null;
  documentRegistry: string | null;
  kadraToken: string | null;
}

type Phase =
  | "not_started"
  | "deployed"
  | "investors_registered"
  | "lpa_anchored"
  | "subscriptions_created"
  | "settled"
  | "complete";

function Spinner() {
  return (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("not_started");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [capTable, setCapTable] = useState<CapTableRow[]>([]);
  const [totalSupply, setTotalSupply] = useState("0");
  const [contracts, setContracts] = useState<ContractAddresses>({
    identityRegistry: null,
    documentRegistry: null,
    kadraToken: null,
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lpaFileName, setLpaFileName] = useState<string | null>(null);
  const [lpaHash, setLpaHash] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const fetchCapTable = useCallback(async () => {
    try {
      const res = await fetch("/api/cap-table");
      const data = await res.json();
      if (data.success) {
        setCapTable(data.capTable);
        setTotalSupply(data.totalSupply);
        if (data.tokenAddress) {
          setContracts((prev) => ({ ...prev, kadraToken: data.tokenAddress }));
        }
      }
    } catch {
      // Cap table not available yet
    }
  }, []);

  // Check existing state on load
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.phase && data.phase !== "not_started") {
          setPhase(data.phase);
          setLogs(data.logs || []);
          if (data.lpaHash) setLpaHash(data.lpaHash);
          if (data.lpaFileName) setLpaFileName(data.lpaFileName);
          if (data.contracts) setContracts(data.contracts);
          fetchCapTable();
        }
      })
      .catch(() => {});
  }, [fetchCapTable]);

  const handleReset = async () => {
    setLoading("Resetting...");
    try {
      await fetch("/api/reset", { method: "POST" });
      setPhase("not_started");
      setLogs([]);
      setCapTable([]);
      setTotalSupply("0");
      setContracts({ identityRegistry: null, documentRegistry: null, kadraToken: null });
      setLpaFileName(null);
      setLpaHash(null);
      setError(null);
    } catch {
      setError("Reset failed");
    } finally {
      setLoading(null);
    }
  };

  // Step 1-3: Deploy contracts and register investors
  const handleDeploy = async () => {
    setLoading("Deploying contracts & registering investors...");
    setError(null);
    try {
      const res = await fetch("/api/deploy", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLogs(data.logs);
      setPhase("investors_registered");
      setContracts(data.contracts);
      await fetchCapTable();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deploy failed");
    } finally {
      setLoading(null);
    }
  };

  // Step 4-5: Upload LPA, hash, anchor, create subscriptions
  const handleUploadLPA = async (file: File) => {
    setLoading(`Hashing ${file.name} & anchoring on-chain...`);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-lpa", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLogs(data.logs);
      setLpaFileName(data.fileName);
      setLpaHash(data.lpaHash);
      setPhase("subscriptions_created");
      await fetchCapTable();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(null);
    }
  };

  // Step 6: Settle all wires and mint tokens
  const handleSettle = async () => {
    setLoading("Validating wires & minting tokens...");
    setError(null);
    try {
      const res = await fetch("/api/settle", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLogs(data.logs);
      setPhase("settled");
      await fetchCapTable();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settlement failed");
    } finally {
      setLoading(null);
    }
  };

  // Step 7: Test illegal transfer
  const handleIllegalTransfer = async () => {
    setLoading("Testing illegal transfer...");
    setError(null);
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromInvestorId: "investor-A",
          amount: "100",
          testIllegal: true,
        }),
      });
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
      await fetchCapTable();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer test failed");
    } finally {
      setLoading(null);
    }
  };

  // Step 8: Legal LP-to-LP transfer
  const handleLegalTransfer = async () => {
    setLoading("Executing LP-to-LP transfer...");
    setError(null);
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromInvestorId: "investor-A",
          toInvestorId: "investor-B",
          amount: "500",
          testIllegal: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.logs) setLogs(data.logs);
      setPhase("complete");
      await fetchCapTable();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setLoading(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUploadLPA(file);
  };

  const stepOrder: Phase[] = [
    "not_started",
    "deployed",
    "investors_registered",
    "lpa_anchored",
    "subscriptions_created",
    "settled",
    "complete",
  ];
  const currentStepIndex = stepOrder.indexOf(phase);

  const steps = [
    { idx: 0, phase: "not_started" as Phase, label: "Deploy Contracts & Register Investors", step: "1-3" },
    { idx: 1, phase: "investors_registered" as Phase, label: "Upload Master LPA & Create Subscriptions", step: "4-5" },
    { idx: 2, phase: "subscriptions_created" as Phase, label: "Validate Wires & Mint Tokens", step: "6" },
    { idx: 3, phase: "settled" as Phase, label: "Test Illegal Transfer (Blocked)", step: "7" },
    { idx: 4, phase: "settled" as Phase, label: "Execute Legal LP-to-LP Transfer", step: "8", extra: true },
  ];

  return (
    <div className="min-h-screen p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Kadra</h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Demo Fund I
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Blockchain-based settlement engine for private real estate funds
          </p>
        </div>
        {phase !== "not_started" && (
          <button
            onClick={handleReset}
            disabled={!!loading}
            className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-3 py-1.5 hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            Reset Demo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Steps + Actions + Cap Table (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Step Progress */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-4 overflow-x-auto">
              {steps.map((step) => {
                const stepPhaseIndex = stepOrder.indexOf(step.phase);
                const isComplete = step.extra
                  ? phase === "complete"
                  : currentStepIndex > stepPhaseIndex;
                const isCurrent = step.extra
                  ? phase === "settled" && step.idx === 4
                  : !step.extra && phase === step.phase && !(phase === "settled" && step.idx < 3);

                return (
                  <div key={step.idx} className="flex items-center gap-2 shrink-0">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        isComplete
                          ? "bg-green-600 text-white"
                          : isCurrent
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-400 border border-gray-200"
                      }`}
                    >
                      {isComplete ? "\u2713" : step.step}
                    </span>
                    <span
                      className={`text-xs whitespace-nowrap ${
                        isComplete
                          ? "text-green-700 font-medium"
                          : isCurrent
                          ? "text-blue-700 font-medium"
                          : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    {step.idx < steps.length - 1 && (
                      <div className={`w-6 h-px ${isComplete ? "bg-green-300" : "bg-gray-200"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Panel */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Step 1-3: Deploy */}
            {phase === "not_started" && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Initialize Fund Infrastructure</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Deploy IdentityRegistry, DocumentRegistry, and KadraToken (ERC-3643) smart contracts.
                  Register 5 pre-approved investors as eligible Limited Partners.
                </p>
                <button
                  onClick={handleDeploy}
                  disabled={!!loading}
                  className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? <><Spinner />{loading}</> : "Deploy & Register Investors"}
                </button>
              </div>
            )}

            {/* Step 4-5: Upload LPA */}
            {phase === "investors_registered" && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Upload Master LPA</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Upload the governing legal document. Kadra generates a SHA-256 hash and anchors it
                  on-chain as an immutable, time-stamped record. Subscription records are created for
                  each investor.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadLPA(file);
                  }}
                />
                {loading ? (
                  <div className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium text-center">
                    <Spinner />{loading}
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    className={`w-full py-8 px-4 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                      dragActive
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                    }`}
                  >
                    <div className="text-gray-500 text-sm">
                      <span className="font-medium text-gray-700">Click to upload</span> or drag and drop
                    </div>
                    <div className="text-xs text-gray-400 mt-1">PDF, TXT, or DOC</div>
                  </div>
                )}
              </div>
            )}

            {/* Step 6: Settle */}
            {phase === "subscriptions_created" && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Settlement Confirmation</h3>
                <p className="text-sm text-gray-500 mb-2">
                  Process 5 mock wire confirmations via 3-way match validation:
                </p>
                <ul className="text-sm text-gray-500 mb-4 ml-4 space-y-0.5 list-disc">
                  <li>Investor identity matches subscription</li>
                  <li>Wire amount matches committed capital ($1M each)</li>
                  <li>Document reference matches governing LPA</li>
                </ul>
                <div className="bg-amber-50 border border-amber-200 rounded p-2.5 mb-4 text-xs text-amber-800">
                  Payments are settled <strong>off-chain</strong>. Wire confirmations are uploaded and parsed to confirm payment.
                  No on-chain payment settlement.
                </div>
                <button
                  onClick={handleSettle}
                  disabled={!!loading}
                  className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? <><Spinner />{loading}</> : "Validate Wires & Mint Tokens"}
                </button>
              </div>
            )}

            {/* Steps 7-8: Transfers */}
            {phase === "settled" && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Transfer Rule Enforcement</h3>
                <p className="text-sm text-gray-500 mb-4">
                  On-chain compliance: the ERC-3643 token queries the IdentityRegistry before every transfer.
                  Non-LP wallets are blocked deterministically — no pending state, no manual review.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={handleIllegalTransfer}
                    disabled={!!loading}
                    className="w-full py-3 px-4 bg-red-50 text-red-700 border border-red-200 rounded-lg font-medium hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading === "Testing illegal transfer..." ? <><Spinner />{loading}</> : "Attempt Illegal Transfer (LP \u2192 Non-LP)"}
                  </button>
                  <button
                    onClick={handleLegalTransfer}
                    disabled={!!loading}
                    className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading === "Executing LP-to-LP transfer..." ? <><Spinner />{loading}</> : "Execute Legal Transfer (Alpha \u2192 Beta, 500 KDRA)"}
                  </button>
                </div>
              </div>
            )}

            {/* Complete */}
            {phase === "complete" && (
              <div className="text-center py-4">
                <div className="text-green-700 text-lg font-semibold mb-1">
                  Full Lifecycle Complete
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Contracts deployed, investors registered, LPA anchored, subscriptions settled,
                  tokens minted, transfers enforced. See cap table and activity log.
                </p>
                <button
                  onClick={handleReset}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Reset and run again
                </button>
              </div>
            )}
          </div>

          {/* Cap Table */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                Ownership Table
              </h2>
              {contracts.kadraToken && (
                <span className="text-xs text-gray-400 font-mono">
                  KDRA {contracts.kadraToken.slice(0, 8)}...{contracts.kadraToken.slice(-6)}
                </span>
              )}
            </div>

            {capTable.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No ownership records yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 pr-4 font-medium text-gray-500">Limited Partner</th>
                      <th className="text-left py-2 pr-4 font-medium text-gray-500">Wallet</th>
                      <th className="text-right py-2 pr-4 font-medium text-gray-500">Tokens</th>
                      <th className="text-right py-2 pr-4 font-medium text-gray-500">Ownership</th>
                      <th className="text-center py-2 font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capTable.map((row) => (
                      <tr key={row.investorId} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2.5 pr-4 font-medium">{row.name}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-gray-500">
                          {row.walletAddress.slice(0, 8)}...{row.walletAddress.slice(-6)}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono">
                          {parseFloat(row.tokenBalance).toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono">{row.ownershipPercent}%</td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              row.status === "settled"
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : row.status === "pending"
                                ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                                : "bg-gray-50 text-gray-500 border border-gray-200"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200">
                      <td className="py-2.5 font-semibold" colSpan={2}>
                        Total Supply
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold">
                        {parseFloat(totalSupply).toLocaleString()} KDRA
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold">
                        {parseFloat(totalSupply) > 0 ? "100%" : "—"}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Contract & Document Info */}
          {(contracts.identityRegistry || lpaHash) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contracts */}
              {contracts.identityRegistry && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Smart Contracts
                  </h2>
                  <div className="text-xs space-y-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-gray-500">IdentityRegistry</span>
                      <span className="text-gray-700">{contracts.identityRegistry?.slice(0, 10)}...{contracts.identityRegistry?.slice(-8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">DocumentRegistry</span>
                      <span className="text-gray-700">{contracts.documentRegistry?.slice(0, 10)}...{contracts.documentRegistry?.slice(-8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">KadraToken</span>
                      <span className="text-gray-700">{contracts.kadraToken?.slice(0, 10)}...{contracts.kadraToken?.slice(-8)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Provenance */}
              {lpaHash && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Document Provenance
                  </h2>
                  <div className="text-sm space-y-1.5">
                    <div>
                      <span className="text-gray-500 text-xs">Source file</span>
                      <div className="font-medium">{lpaFileName}</div>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs">SHA-256 fingerprint</span>
                      <div className="font-mono text-xs break-all text-gray-700">{lpaHash}</div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs text-green-700 font-medium">Anchored on-chain</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Live Activity Log (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 flex flex-col lg:sticky lg:top-6" style={{ height: "calc(100vh - 96px)" }}>
          <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Activity Log
            </h2>
            <span className="text-xs text-gray-400">
              {logs.length > 0 ? `${logs.length} events` : "Waiting"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">
                  Initialize the fund to begin
                </p>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`log-entry ${log.type}`}>
                  <span className="text-gray-400 mr-2 text-xs">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="font-medium mr-1.5 text-gray-500 text-xs">{log.step}</span>
                  <span
                    className={`text-xs ${
                      log.type === "success"
                        ? "text-green-700"
                        : log.type === "error"
                        ? "text-red-700"
                        : log.type === "warning"
                        ? "text-amber-700"
                        : "text-gray-700"
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
