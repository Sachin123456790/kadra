import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  DollarSign,
  FileText as FileTextIcon,
  Mail,
  Plus,
  Shield,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/angainor/PageHeader";
import { SectionCard } from "@/components/angainor/SectionCard";
import { OnboardingStages } from "@/components/angainor/OnboardingStages";
import { ErrorAlert } from "@/components/angainor/ErrorAlert";
import { StatusBadge } from "@/components/angainor/StatusBadge";
import { ExplorerLink } from "@/components/angainor/ExplorerLink";
import { TechnicalDetails } from "@/components/angainor/TechnicalDetails";
import { DocumentViewerModal } from "@/components/angainor/DocumentViewerModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DEFAULT_FUND_CODE, QUERY_KEYS } from "@/config/constants";
import {
  getDocuments,
  getInvestors,
  getSubscriptions,
  linkInvestorWallet,
  adminAutoGenerateWallet,
  updateInvestorEligibility,
  updateInvestorVerification,
} from "@/services";
import type { UpdateVerificationBody } from "@/services/investors.service";
import { getCapTable, getCapitalAccounts } from "@/services/ownership.service";
import { toFriendlyMessage } from "@/lib/errorMessages";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

export default function InvestorOnboardingDetailPage() {
  const { investorId = "" } = useParams<{ investorId: string }>();
  const navigate = useNavigate();
  const fundId = DEFAULT_FUND_CODE;
  const queryClient = useQueryClient();

  const [linkWalletOpen, setLinkWalletOpen] = useState(false);
  const [walletAddressInput, setWalletAddressInput] = useState("");
  const [viewerDoc, setViewerDoc] = useState<{ id: string; filename: string } | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.investors(fundId) });

  const { data: rawInvestors, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investors(fundId),
    queryFn: () => getInvestors(fundId).then((r) => r.data),
  });
  const { data: capTable } = useQuery({
    queryKey: QUERY_KEYS.capTable(fundId),
    queryFn: () => getCapTable(fundId).then((r) => r.data),
  });
  const { data: allSubscriptions } = useQuery({
    queryKey: QUERY_KEYS.subscriptions(fundId),
    queryFn: () => getSubscriptions(fundId).then((r) => r.data),
  });
  const { data: capitalAccounts } = useQuery({
    queryKey: QUERY_KEYS.capitalAccounts(fundId),
    queryFn: () => getCapitalAccounts(fundId).then((r) => r.data),
  });
  const { data: documents } = useQuery({
    queryKey: QUERY_KEYS.documents(fundId),
    queryFn: () => getDocuments(fundId).then((r) => r.data),
  });

  const investor = rawInvestors?.find((inv) => inv.investorId === investorId) ?? null;
  const selectedCapitalAccount =
    investor && capitalAccounts
      ? capitalAccounts.find((ca) => ca.investorId === investor.investorId)
      : undefined;
  const selectedInvestorDocs =
    investor && documents
      ? documents.filter(
          (d) =>
            (d.linkedEntityType === "INVESTOR" && d.linkedEntityId === investor.investorId) ||
            (d.metadata as Record<string, unknown>)?.investorId === investor.investorId ||
            (d.metadata as Record<string, unknown>)?.investorName === investor.legalName ||
            d.uploadedBy === investor.email,
        )
      : [];
  const selectedInvestorSubs =
    investor && allSubscriptions
      ? allSubscriptions.filter((s) => s.investorId === investor.investorId)
      : [];
  const capTableRow =
    investor && capTable
      ? capTable.rows.find((row) => row.investorId === investor.investorId)
      : null;

  const verificationMutation = useMutation({
    mutationFn: ({
      investorId: id,
      body,
    }: {
      investorId: string;
      body: UpdateVerificationBody;
    }) => updateInvestorVerification(id, body),
    onSuccess: () => {
      toast.success("Investor verification updated");
      invalidate();
    },
    onError: (err) => toast.error(toFriendlyMessage(err)),
  });

  const eligibilityMutation = useMutation({
    mutationFn: ({
      investorId: id,
      walletId,
      status,
    }: {
      investorId: string;
      walletId: string;
      status: string;
    }) => updateInvestorEligibility(fundId, { investorId: id, walletId, status }),
    onSuccess: () => {
      toast.success("Fund eligibility updated");
      invalidate();
    },
    onError: (err) => toast.error(toFriendlyMessage(err)),
  });

  const linkWalletMutation = useMutation({
    mutationFn: ({
      investorId: id,
      address,
    }: {
      investorId: string;
      address: string;
    }) => linkInvestorWallet(id, address),
    onSuccess: () => {
      toast.success("Wallet linked to investor");
      invalidate();
      setLinkWalletOpen(false);
      setWalletAddressInput("");
    },
    onError: (err) => toast.error(toFriendlyMessage(err)),
  });

  const autoGenerateWalletMutation = useMutation({
    mutationFn: ({ investorId: id }: { investorId: string }) =>
      adminAutoGenerateWallet(id, {}),
    onSuccess: (res) => {
      toast.success(`Custodial wallet created: ${res.data.address}`);
      invalidate();
      setLinkWalletOpen(false);
      setWalletAddressInput("");
    },
    onError: (err) => toast.error(toFriendlyMessage(err)),
  });

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/investors")}
          className="mb-2 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to investors
        </Button>
        <PageHeader
          title={investor ? investor.legalName : "Investor detail"}
          subtitle={investor?.email ?? "Onboarding progress and admin actions"}
        />
      </div>

      {error && <ErrorAlert error={error} />}

      {isLoading && <SectionCard>Loading…</SectionCard>}

      {!isLoading && !investor && (
        <SectionCard>
          <p className="text-sm text-muted-foreground">
            Investor not found.{" "}
            <Link to="/investors" className="underline">
              Return to the investors list
            </Link>
            .
          </p>
        </SectionCard>
      )}

      {investor && investor.onboarding && (
        <SectionCard title="Onboarding progress">
          <OnboardingStages
            summary={investor.onboarding}
            mode="admin"
            actions={{
              kyc: {
                label: "Approve KYC",
                loading: verificationMutation.isPending,
                onClick: () =>
                  verificationMutation.mutate({
                    investorId: investor.investorId,
                    body: { kycStatus: "APPROVED" },
                  }),
              },
              accreditation: {
                label: "Approve accreditation",
                loading: verificationMutation.isPending,
                onClick: () =>
                  verificationMutation.mutate({
                    investorId: investor.investorId,
                    body: { accreditationStatus: "APPROVED" },
                  }),
              },
              wallet: {
                label: "Link wallet",
                onClick: () => setLinkWalletOpen(true),
              },
              eligibility: {
                label: "Approve eligibility",
                disabled:
                  eligibilityMutation.isPending || investor.wallets.length === 0,
                loading: eligibilityMutation.isPending,
                onClick: () => {
                  const wallet = investor.wallets[0];
                  if (!wallet) {
                    toast.error("Link a wallet before setting eligibility");
                    return;
                  }
                  eligibilityMutation.mutate({
                    investorId: investor.investorId,
                    walletId: wallet.walletId,
                    status: "ELIGIBLE",
                  });
                },
              },
            }}
          />
        </SectionCard>
      )}

      {investor && (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Identity">
            <dl className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1">
                  <dt className="text-xs text-muted-foreground">Legal Name</dt>
                  <dd className="text-sm font-medium text-foreground">{investor.legalName}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1">
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="text-sm text-foreground">{investor.email}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-gray-400 shrink-0" />
                <div className="flex-1">
                  <dt className="text-xs text-muted-foreground">Verification Status</dt>
                  <dd className="mt-1"><StatusBadge status={investor.verificationStatus} /></dd>
                </div>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Documents">
            {selectedInvestorDocs.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <FileTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-sm text-muted-foreground">No documents uploaded</span>
              </div>
            ) : (
              <ul className="space-y-2">
                {selectedInvestorDocs.map((d) => (
                  <li key={d.documentId}>
                    <button
                      type="button"
                      onClick={() =>
                        setViewerDoc({ id: d.documentId, filename: d.originalFilename })
                      }
                      className="w-full flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 text-left hover:bg-muted transition-colors"
                    >
                      <FileTextIcon className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {d.originalFilename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.documentType.replace(/_/g, " ")} · {new Date(d.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary">View</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Compliance Flags">
            <dl className="space-y-2">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground flex items-center gap-2">
                  {investor.kycStatus === "APPROVED" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  )}
                  KYC Verified
                </dt>
                <dd className="text-sm text-foreground">
                  {investor.kycStatus === "APPROVED" ? "Yes" : "No"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground flex items-center gap-2">
                  {investor.accreditationStatus === "APPROVED" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-gray-400" />
                  )}
                  Accreditation Status
                </dt>
                <dd className="text-sm text-foreground">
                  {investor.accreditationStatus === "APPROVED"
                    ? "Accredited"
                    : "Unaccredited"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">Eligibility</dt>
                <dd className="text-sm">
                  {investor.fundEligibility ? (
                    <StatusBadge status={investor.fundEligibility.status} />
                  ) : (
                    <span className="text-muted-foreground">Inactive</span>
                  )}
                </dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Admin Actions">
            <div className="space-y-3">
              <AdminStatusSelect
                label="Verification"
                value={investor.verificationStatus}
                options={["UNKNOWN", "VERIFIED", "REVOKED"]}
                disabled={verificationMutation.isPending}
                onChange={(val) =>
                  verificationMutation.mutate({
                    investorId: investor.investorId,
                    body: { verificationStatus: val as "UNKNOWN" | "VERIFIED" | "REVOKED" },
                  })
                }
              />
              <AdminStatusSelect
                label="KYC Status"
                value={investor.kycStatus ?? "PENDING"}
                options={["PENDING", "APPROVED", "REJECTED"]}
                disabled={verificationMutation.isPending}
                onChange={(val) =>
                  verificationMutation.mutate({
                    investorId: investor.investorId,
                    body: { kycStatus: val as "PENDING" | "APPROVED" | "REJECTED" },
                  })
                }
              />
              <AdminStatusSelect
                label="Accreditation"
                value={investor.accreditationStatus ?? "PENDING"}
                options={["PENDING", "APPROVED", "REJECTED"]}
                disabled={verificationMutation.isPending}
                onChange={(val) =>
                  verificationMutation.mutate({
                    investorId: investor.investorId,
                    body: { accreditationStatus: val as "PENDING" | "APPROVED" | "REJECTED" },
                  })
                }
              />
              <AdminStatusSelect
                label="Fund Eligibility"
                value={investor.fundEligibility?.status ?? "NONE"}
                options={["ELIGIBLE", "REVOKED"]}
                disabled={
                  eligibilityMutation.isPending || investor.wallets.length === 0
                }
                onChange={(val) => {
                  const wallet = investor.wallets[0];
                  if (!wallet) {
                    toast.error("Link a wallet before setting eligibility");
                    return;
                  }
                  eligibilityMutation.mutate({
                    investorId: investor.investorId,
                    walletId: wallet.walletId,
                    status: val,
                  });
                }}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Wallet</span>
                {investor.wallets.length === 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setWalletAddressInput("");
                      setLinkWalletOpen(true);
                    }}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add wallet
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Linked · {investor.wallets[0].address.slice(0, 6)}…{investor.wallets[0].address.slice(-4)}
                    {investor.wallets.length > 1 && ` (+${investor.wallets.length - 1})`}
                  </span>
                )}
              </div>
              {investor.wallets.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No wallet linked yet. Fund eligibility requires a wallet.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Capital Account">
            {selectedCapitalAccount ? (
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Capital Contributed</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {fmtCurrency(Number(selectedCapitalAccount.initialContribution))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Capital Returned</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {fmtCurrency(Number(selectedCapitalAccount.capitalReturned))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Accrued Pref Return</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {fmtCurrency(Number(selectedCapitalAccount.accruedPreferredReturn))}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-muted-foreground">Ending Balance</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {fmtCurrency(Number(selectedCapitalAccount.endingBalance))}
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
                <DollarSign className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-sm text-muted-foreground">N/A</span>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {investor && selectedInvestorSubs.length > 0 && (
        <SectionCard title="Subscriptions">
          <div className="space-y-3">
            {selectedInvestorSubs.map((sub) => (
              <div
                key={sub.subscriptionId}
                className="space-y-2 rounded-lg border border-border bg-muted/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <FileTextIcon className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="flex-1">
                    <dt className="text-xs text-muted-foreground">Subscription Ref</dt>
                    <dd className="text-sm font-medium text-foreground">{sub.subscriptionRef}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="flex-1">
                    <dt className="text-xs text-muted-foreground">Settlement Date</dt>
                    <dd className="text-sm text-foreground">
                      {sub.settledAt ? new Date(sub.settledAt).toLocaleString() : "Not settled"}
                    </dd>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={sub.status} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Committed</span>
                  <span className="font-medium text-foreground">
                    ${Number(sub.committedAmount).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {investor && (
        <TechnicalDetails label="Technical Details">
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Wallets
              </h3>
              {investor.wallets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No wallets linked</p>
              ) : (
                <div className="space-y-2">
                  {investor.wallets.map((wallet) => (
                    <div
                      key={wallet.walletId}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3"
                    >
                      <Wallet className="h-4 w-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          <ExplorerLink value={wallet.address} type="address" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Chain {wallet.chainId}
                          {wallet.isPrimary && " · Primary"} · {wallet.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Fund Eligibility
              </h3>
              {investor.fundEligibility ? (
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Status</dt>
                    <dd><StatusBadge status={investor.fundEligibility.status} /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Effective</dt>
                    <dd className="text-sm font-medium text-foreground">
                      {investor.fundEligibility.effectiveAt
                        ? new Date(investor.fundEligibility.effectiveAt).toLocaleDateString()
                        : "N/A"}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">No eligibility record</p>
              )}
            </div>

            {capTableRow && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Fund Ownership
                </h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Settled Units</dt>
                    <dd className="text-sm font-medium font-mono text-foreground">
                      {capTableRow.settledTokenBalance}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Ownership %</dt>
                    <dd className="text-sm font-medium text-foreground">
                      {capTableRow.ownershipPct}%
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-muted-foreground">Pending Allocation</dt>
                    <dd className="text-sm font-medium text-foreground">
                      {capTableRow.pendingAllocationPct}%
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </TechnicalDetails>
      )}

      {viewerDoc && (
        <DocumentViewerModal
          open={Boolean(viewerDoc)}
          onOpenChange={(open) => {
            if (!open) setViewerDoc(null);
          }}
          contentPath={`/admin/documents/${viewerDoc.id}/content`}
          filename={viewerDoc.filename}
        />
      )}

      <Dialog open={linkWalletOpen} onOpenChange={setLinkWalletOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Wallet</DialogTitle>
            <DialogDescription>
              Generate a custodial wallet for the investor in one click, or
              import an address they already control.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-sm font-semibold text-foreground">
                Generate custodial wallet
              </div>
              <p className="text-xs text-muted-foreground">
                Angainor creates a Sepolia wallet and securely manages the
                private key. Marks the wallet as CUSTODIAL and clears the
                onboarding step.
              </p>
              <Button
                onClick={() => {
                  if (!investor) return;
                  autoGenerateWalletMutation.mutate({
                    investorId: investor.investorId,
                  });
                }}
                disabled={
                  autoGenerateWalletMutation.isPending ||
                  linkWalletMutation.isPending
                }
                className="w-full"
              >
                {autoGenerateWalletMutation.isPending
                  ? "Generating…"
                  : "Generate wallet for investor"}
              </Button>
            </div>

            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider">
                <span className="bg-background px-2 text-muted-foreground">
                  Or import existing
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="walletAddress">Wallet address</Label>
              <Input
                id="walletAddress"
                placeholder="0x…"
                value={walletAddressInput}
                onChange={(e) => setWalletAddressInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste the address the investor already controls. Marked as
                IMPORTED.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setLinkWalletOpen(false)}
              disabled={
                linkWalletMutation.isPending ||
                autoGenerateWalletMutation.isPending
              }
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!investor) return;
                const addr = walletAddressInput.trim();
                if (!addr.startsWith("0x") || addr.length !== 42) {
                  toast.error("Enter a valid 0x… address");
                  return;
                }
                linkWalletMutation.mutate({
                  investorId: investor.investorId,
                  address: addr,
                });
              }}
              disabled={
                linkWalletMutation.isPending ||
                autoGenerateWalletMutation.isPending ||
                !walletAddressInput.trim()
              }
            >
              {linkWalletMutation.isPending ? "Linking…" : "Import address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminStatusSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly disabled?: boolean;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <select
        value={options.includes(value) ? value : ""}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          if (next && next !== value) onChange(next);
        }}
        className="rounded-md border border-gray-300 bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
      >
        {!options.includes(value) && <option value="">Select...</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
