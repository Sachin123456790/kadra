import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getInvestors, getSubscriptions, getDocuments } from "@/services";
import { getCapTable, getCapitalAccounts } from "@/services/ownership.service";
import { Calendar, FileText as FileTextIcon, DollarSign } from "lucide-react";
import type { Investor } from "@/services/investors.service";
import type { CapitalAccountSummary } from "@/services/ownership.service";
import { X, User, Wallet, Shield, Mail, CheckCircle2, XCircle } from "lucide-react";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";

// ── View-model for the table ──────────────────────────────────

interface InvestorTableRow {
  id: string;
  name: string;
  wallet: string;
  verificationStatus: string;
  fundEligibility: string;
  ownership: number;
  kycStatus: string;
  accreditationStatus: string;
  eligibilityOnChain: string;
  tokenBalance: string;
  settlementStatus: string;
  lastActivity: string;
}

// ── Helpers ──────────────────────────────────────────────────

function deriveSettlementStatus(
  investorId: string,
  subscriptions: Array<{ investorId: string; status: string }> | undefined,
): string {
  if (!subscriptions) return "Not Started";
  const investorSubs = subscriptions.filter(s => s.investorId === investorId);
  if (investorSubs.length === 0) return "Not Started";
  if (investorSubs.every(s => s.status === "SETTLED")) return "Settled";
  if (investorSubs.some(s => s.status === "SETTLED" || s.status === "PENDING")) return "Pending";
  return "Not Started";
}

function deriveLastActivity(
  investor: Investor,
  subscriptions: Array<{ investorId: string; settledAt: string | null; createdAt: string | null }> | undefined,
): string {
  const timestamps: number[] = [];

  if (investor.fundEligibility?.effectiveAt) {
    timestamps.push(new Date(investor.fundEligibility.effectiveAt).getTime());
  }

  if (subscriptions) {
    for (const sub of subscriptions.filter(s => s.investorId === investor.investorId)) {
      if (sub.settledAt) timestamps.push(new Date(sub.settledAt).getTime());
      if (sub.createdAt) timestamps.push(new Date(sub.createdAt).getTime());
    }
  }

  if (timestamps.length === 0) return "";
  return new Date(Math.max(...timestamps)).toLocaleDateString();
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

// ── Main component ──────────────────────────────────────────

export default function InvestorsPage() {
  const fundId = DEFAULT_FUND_CODE;
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | null>(null);

  const { data: rawInvestors, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investors(fundId),
    queryFn: () => getInvestors(fundId).then(r => r.data),
  });

  const { data: capTable } = useQuery({
    queryKey: QUERY_KEYS.capTable(fundId),
    queryFn: () => getCapTable(fundId).then(r => r.data),
  });

  const { data: allSubscriptions } = useQuery({
    queryKey: QUERY_KEYS.subscriptions(fundId),
    queryFn: () => getSubscriptions(fundId).then(r => r.data),
  });

  const { data: capitalAccounts } = useQuery({
    queryKey: QUERY_KEYS.capitalAccounts(fundId),
    queryFn: () => getCapitalAccounts(fundId).then(r => r.data),
  });

  const { data: documents } = useQuery({
    queryKey: QUERY_KEYS.documents(fundId),
    queryFn: () => getDocuments(fundId).then(r => r.data),
  });

  const investors: InvestorTableRow[] | undefined = rawInvestors?.map((inv) => {
    const ownership = capTable?.rows?.find(r => r.investorId === inv.investorId);
    const isVerified = inv.verificationStatus === "Verified";
    const eligibilityStatus = inv.fundEligibility?.status ?? "N/A";
    const isEligible = eligibilityStatus === "APPROVED" || eligibilityStatus === "ELIGIBLE";

    return {
      id: inv.investorId,
      name: inv.legalName,
      wallet: inv.wallets?.[0]?.address ?? "No wallet linked",
      verificationStatus: inv.verificationStatus,
      fundEligibility: eligibilityStatus,
      ownership: ownership?.ownershipPct ?? 0,
      kycStatus: isVerified ? "Verified" : "Unverified",
      accreditationStatus: isVerified ? "Accredited" : "Unaccredited",
      eligibilityOnChain: isEligible ? "Yes" : "No",
      tokenBalance: ownership?.settledTokenBalance ?? "0",
      settlementStatus: deriveSettlementStatus(inv.investorId, allSubscriptions),
      lastActivity: deriveLastActivity(inv, allSubscriptions),
    };
  });

  const handleView = (row: InvestorTableRow) => {
    const investor = rawInvestors?.find(inv => inv.investorId === row.id);
    if (investor) setSelectedInvestor(investor);
  };

  const columns: Column<InvestorTableRow>[] = [
    { key: "name", header: "Investor Name" },
    { key: "wallet", header: "Wallet Address", render: (r) => <ExplorerLink value={r.wallet} type="address" /> },
    {
      key: "kycStatus",
      header: "KYC Status",
      render: (r) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          r.kycStatus === "Verified"
            ? "bg-green-50 text-green-700"
            : "bg-red-50 text-red-700"
        }`}>
          {r.kycStatus}
        </span>
      ),
    },
    {
      key: "accreditationStatus",
      header: "Accreditation",
      render: (r) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          r.accreditationStatus === "Accredited"
            ? "bg-green-50 text-green-700"
            : "bg-gray-100 text-gray-600"
        }`}>
          {r.accreditationStatus}
        </span>
      ),
    },
    {
      key: "eligibilityOnChain",
      header: "Eligibility On-Chain",
      render: (r) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          r.eligibilityOnChain === "Yes"
            ? "bg-green-50 text-green-700"
            : "bg-gray-100 text-gray-500"
        }`}>
          {r.eligibilityOnChain}
        </span>
      ),
    },
    {
      key: "tokenBalance",
      header: "Token Balance",
      render: (r) => <span className="font-mono text-xs text-gray-900">{r.tokenBalance}</span>,
    },
    {
      key: "settlementStatus",
      header: "Settlement",
      render: (r) => {
        const colorMap: Record<string, string> = {
          Settled: "bg-green-50 text-green-700",
          Pending: "bg-amber-50 text-amber-700",
          "Not Started": "bg-gray-100 text-gray-500",
        };
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorMap[r.settlementStatus] ?? "bg-gray-100 text-gray-500"}`}>
            {r.settlementStatus}
          </span>
        );
      },
    },
    {
      key: "lastActivity",
      header: "Last Activity",
      render: (r) => <span className="text-xs text-gray-600">{r.lastActivity || "--"}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <button
          onClick={() => handleView(r)}
          className="text-xs text-primary font-medium hover:underline"
        >
          View
        </button>
      ),
    },
  ];

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load investors" message={(error as Error).message} />;
  if (!investors || investors.length === 0) return <EmptyState title="No investors" message="No investors have been registered yet." />;

  // Derive data for selected investor modal
  const selectedCapitalAccount: CapitalAccountSummary | undefined =
    selectedInvestor && capitalAccounts
      ? capitalAccounts.find(ca => ca.investorId === selectedInvestor.investorId)
      : undefined;

  const selectedInvestorDocCount: number =
    documents ? documents.length : 0;

  const selectedInvestorSubs = selectedInvestor && allSubscriptions
    ? allSubscriptions.filter(s => s.investorId === selectedInvestor.investorId)
    : [];

  return (
    <div>
      <PageHeader title="Investors" subtitle="Manage fund investors and verification status" />
      <SectionCard>
        <DataTable columns={columns} data={investors} getRowId={(r) => r.id} />
      </SectionCard>

      {/* Investor Detail Modal */}
      {selectedInvestor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setSelectedInvestor(null)}
          />
          {/* Modal */}
          <div className="relative bg-white border border-gray-200 rounded-xl shadow-lg w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedInvestor.legalName}</h2>
                <p className="text-sm text-gray-500">Investor Details</p>
              </div>
              <button
                onClick={() => setSelectedInvestor(null)}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Identity */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Identity</h3>
                <dl className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1">
                      <dt className="text-xs text-gray-500">Legal Name</dt>
                      <dd className="text-sm font-medium text-gray-900">{selectedInvestor.legalName}</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1">
                      <dt className="text-xs text-gray-500">Email</dt>
                      <dd className="text-sm text-gray-900">{selectedInvestor.email}</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1">
                      <dt className="text-xs text-gray-500">Verification Status</dt>
                      <dd className="mt-1"><StatusBadge status={selectedInvestor.verificationStatus} /></dd>
                    </div>
                  </div>
                </dl>
              </div>

              {/* Wallets */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Wallets</h3>
                {selectedInvestor.wallets.length === 0 ? (
                  <p className="text-sm text-gray-500">No wallets linked</p>
                ) : (
                  <div className="space-y-2">
                    {selectedInvestor.wallets.map((w) => (
                      <div key={w.walletId} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                        <Wallet className="h-4 w-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm"><ExplorerLink value={w.address} type="address" /></div>
                          <p className="text-xs text-gray-500">
                            Chain {w.chainId} {w.isPrimary && "-- Primary"} -- {w.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documents section */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Documents</h3>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                  <FileTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-900">
                    {selectedInvestorDocCount > 0
                      ? `${selectedInvestorDocCount} document${selectedInvestorDocCount !== 1 ? "s" : ""}`
                      : "No documents"}
                  </span>
                </div>
              </div>

              {/* Compliance Flags */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Compliance Flags</h3>
                <dl className="space-y-2">
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-gray-500 flex items-center gap-2">
                      {selectedInvestor.verificationStatus === "Verified"
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                      KYC Verified
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {selectedInvestor.verificationStatus === "Verified" ? "Yes" : "No"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-gray-500 flex items-center gap-2">
                      {selectedInvestor.verificationStatus === "Verified"
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        : <XCircle className="h-3.5 w-3.5 text-gray-400" />}
                      Accreditation Status
                    </dt>
                    <dd className="text-sm text-gray-900">
                      {selectedInvestor.verificationStatus === "Verified" ? "Accredited" : "Unaccredited"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-sm text-gray-500">Fund Eligibility Marker</dt>
                    <dd className="text-sm">
                      {selectedInvestor.fundEligibility ? (
                        <span className="flex items-center gap-2">
                          <StatusBadge status={selectedInvestor.fundEligibility.status} />
                          <span className="text-xs text-gray-500">
                            {selectedInvestor.fundEligibility.effectiveAt
                              ? `since ${new Date(selectedInvestor.fundEligibility.effectiveAt).toLocaleDateString()}`
                              : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-500">Inactive</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Capital Account Summary */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Capital Account</h3>
                {selectedCapitalAccount ? (
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Capital Contributed</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {fmtCurrency(Number(selectedCapitalAccount.initialContribution))}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Capital Returned</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {fmtCurrency(Number(selectedCapitalAccount.capitalReturned))}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Accrued Pref Return</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {fmtCurrency(Number(selectedCapitalAccount.accruedPreferredReturn))}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Ending Balance</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {fmtCurrency(Number(selectedCapitalAccount.endingBalance))}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                    <DollarSign className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-500">N/A</span>
                  </div>
                )}
              </div>

              {/* Fund Eligibility */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Fund Eligibility</h3>
                {selectedInvestor.fundEligibility ? (
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Status</dt>
                      <dd><StatusBadge status={selectedInvestor.fundEligibility.status} /></dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500">Effective</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {selectedInvestor.fundEligibility.effectiveAt
                          ? new Date(selectedInvestor.fundEligibility.effectiveAt).toLocaleDateString()
                          : "N/A"}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-gray-500">No eligibility record</p>
                )}
              </div>

              {/* Subscription Details */}
              {selectedInvestorSubs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Subscriptions</h3>
                  <div className="space-y-3">
                    {selectedInvestorSubs.map((sub) => (
                      <div key={sub.subscriptionId} className="p-3 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
                        <div className="flex items-center gap-3">
                          <FileTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
                          <div className="flex-1">
                            <dt className="text-xs text-gray-500">Subscription Ref</dt>
                            <dd className="text-sm font-medium text-gray-900">{sub.subscriptionRef}</dd>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                          <div className="flex-1">
                            <dt className="text-xs text-gray-500">Settlement Date</dt>
                            <dd className="text-sm text-gray-900">
                              {sub.settledAt ? new Date(sub.settledAt).toLocaleString() : "Not settled"}
                            </dd>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Status</span>
                          <StatusBadge status={sub.status} />
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Committed</span>
                          <span className="font-medium text-gray-900">
                            ${Number(sub.committedAmount).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ownership from cap table */}
              {capTable && (() => {
                const row = capTable.rows.find(r => r.investorId === selectedInvestor.investorId);
                if (!row) return null;
                return (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Ownership</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Token Balance</dt>
                        <dd className="text-sm font-medium font-mono text-gray-900">{row.settledTokenBalance}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Ownership %</dt>
                        <dd className="text-sm font-medium text-gray-900">{row.ownershipPct}%</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Pending Allocation</dt>
                        <dd className="text-sm font-medium text-gray-900">{row.pendingAllocationPct}%</dd>
                      </div>
                    </dl>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
