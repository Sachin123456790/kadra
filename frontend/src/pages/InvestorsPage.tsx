import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getInvestors, getSubscriptions } from "@/services";
import { getCapTable } from "@/services/ownership.service";
import { Calendar, FileText as FileTextIcon } from "lucide-react";
import type { Investor } from "@/services/investors.service";
import type { InvestorRow } from "@/types/api";
import { X, User, Wallet, Shield, Mail } from "lucide-react";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";

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

  const { data: subscriptions } = useQuery({
    queryKey: QUERY_KEYS.subscriptions(fundId),
    queryFn: () => getSubscriptions(fundId).then(r => r.data),
    enabled: !!selectedInvestor,
  });

  const investors: InvestorRow[] | undefined = rawInvestors?.map((inv) => {
    const ownership = capTable?.rows?.find(r => r.investorId === inv.investorId);
    return {
      id: inv.investorId,
      name: inv.legalName,
      wallet: inv.wallets?.[0]?.address ?? "No wallet linked",
      verificationStatus: inv.verificationStatus,
      fundEligibility: inv.fundEligibility?.status ?? "N/A",
      ownership: ownership?.ownershipPct ?? 0,
    };
  });

  const handleView = (row: InvestorRow) => {
    const investor = rawInvestors?.find(inv => inv.investorId === row.id);
    if (investor) setSelectedInvestor(investor);
  };

  const columns: Column<InvestorRow>[] = [
    { key: "name", header: "Investor Name" },
    { key: "wallet", header: "Wallet Address", render: (r) => <ExplorerLink value={r.wallet} type="address" /> },
    { key: "verificationStatus", header: "Status", render: (r) => <StatusBadge status={r.verificationStatus} /> },
    { key: "fundEligibility", header: "Fund Eligibility" },
    { key: "ownership", header: "Ownership %", render: (r) => `${r.ownership}%` },
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
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => setSelectedInvestor(null)}
          />
          {/* Modal */}
          <div className="relative bg-card border border-border rounded-xl shadow-lg w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selectedInvestor.legalName}</h2>
                <p className="text-sm text-muted-foreground">Investor Details</p>
              </div>
              <button
                onClick={() => setSelectedInvestor(null)}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Identity */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Identity</h3>
                <dl className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <dt className="text-xs text-muted-foreground">Legal Name</dt>
                      <dd className="text-sm font-medium">{selectedInvestor.legalName}</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <dt className="text-xs text-muted-foreground">Email</dt>
                      <dd className="text-sm">{selectedInvestor.email}</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <dt className="text-xs text-muted-foreground">Verification Status</dt>
                      <dd className="mt-1"><StatusBadge status={selectedInvestor.verificationStatus} /></dd>
                    </div>
                  </div>
                </dl>
              </div>

              {/* Wallets */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Wallets</h3>
                {selectedInvestor.wallets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No wallets linked</p>
                ) : (
                  <div className="space-y-2">
                    {selectedInvestor.wallets.map((w) => (
                      <div key={w.walletId} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                        <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm"><ExplorerLink value={w.address} type="address" /></div>
                          <p className="text-xs text-muted-foreground">
                            Chain {w.chainId} {w.isPrimary && "· Primary"} · {w.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fund Eligibility */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Fund Eligibility</h3>
                {selectedInvestor.fundEligibility ? (
                  <dl className="space-y-2">
                    <div className="flex justify-between">
                      <dt className="text-sm text-muted-foreground">Status</dt>
                      <dd><StatusBadge status={selectedInvestor.fundEligibility.status} /></dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-muted-foreground">Effective</dt>
                      <dd className="text-sm font-medium">
                        {selectedInvestor.fundEligibility.effectiveAt
                          ? new Date(selectedInvestor.fundEligibility.effectiveAt).toLocaleDateString()
                          : "N/A"}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No eligibility record</p>
                )}
              </div>

              {/* Subscription Details */}
              {subscriptions && (() => {
                const investorSubs = subscriptions.filter(s => s.investorId === selectedInvestor.investorId);
                if (investorSubs.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Subscriptions</h3>
                    <div className="space-y-3">
                      {investorSubs.map((sub) => (
                        <div key={sub.subscriptionId} className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
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
                );
              })()}

              {/* Ownership from cap table */}
              {capTable && (() => {
                const row = capTable.rows.find(r => r.investorId === selectedInvestor.investorId);
                if (!row) return null;
                return (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ownership</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Token Balance</dt>
                        <dd className="text-sm font-medium font-mono">{row.settledTokenBalance}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Ownership %</dt>
                        <dd className="text-sm font-medium">{row.ownershipPct}%</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">Pending Allocation</dt>
                        <dd className="text-sm font-medium">{row.pendingAllocationPct}%</dd>
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
