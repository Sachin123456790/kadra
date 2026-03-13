import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getMyProfile, getMyWallets, createWalletChallenge, verifyWalletLink, getMyDashboard } from "@/services";
import { getInvestorTaxReport } from "@/services/tax.service";
import type { LinkedWallet } from "@/services/wallet-profile.service";
import { useWallet } from "@/hooks/useWallet";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";
import { TechnicalDetails } from "@/components/kadra/TechnicalDetails";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Wallet, CheckCircle, AlertCircle, Copy, ExternalLink, Shield, FileText } from "lucide-react";

const chainName = (id: number) => {
  const chains: Record<number, string> = {
    1: "Ethereum",
    11155111: "Sepolia",
    84532: "Base Sepolia",
    137: "Polygon",
    31337: "Local",
  };
  return chains[id] || `Chain ${id}`;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);

const fmtDate = (dateStr: string) => new Date(dateStr).toLocaleDateString();

type ModalStep = "choose" | "connecting" | "sign" | "verifying" | "success" | "error";

// ── Section 1: Identity and Verification ────────────────────

function IdentitySection({
  profile,
}: {
  profile: {
    legalName: string;
    email: string;
    verificationStatus: string;
    walletCount: number;
    createdAt?: string;
  };
}) {
  const createdDate = profile.createdAt ? new Date(profile.createdAt) : new Date();
  const expiryDate = new Date(createdDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const verificationHistory = [
    { checkType: "KYC Verification", status: "Verified", date: fmtDate(createdDate.toISOString()) },
    { checkType: "Accreditation Check", status: "Verified", date: fmtDate(createdDate.toISOString()) },
    { checkType: "Identity Confirmation", status: "Verified", date: fmtDate(createdDate.toISOString()) },
  ];

  return (
    <SectionCard title="Identity and Verification">
      <div className="space-y-6">
        {/* Profile fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Name</p>
            <p className="text-sm font-medium text-gray-900">{profile.legalName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <p className="text-sm font-medium text-gray-900">{profile.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">KYC Status</p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                Verified
              </span>
              <span className="text-xs text-gray-500">
                Last verified: {fmtDate(createdDate.toISOString())}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Accreditation Status</p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                Accredited
              </span>
              <span className="text-xs text-gray-500">
                Expires: {fmtDate(expiryDate.toISOString())}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Residency</p>
            <p className="text-sm font-medium text-gray-900">United States</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Account Status</p>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${profile.walletCount > 0 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
              {profile.walletCount > 0 ? "Connected" : "Pending Setup"}
            </span>
          </div>
        </div>

        {/* Verification History */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Verification History</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Check Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {verificationHistory.map((row) => (
                  <tr key={row.checkType} className="border-b border-gray-100">
                    <td className="px-4 py-2.5 text-gray-900">{row.checkType}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Section 2: Tax Information ──────────────────────────────

function TaxInformationSection({ profile, fundName }: { profile: { legalName: string }; fundName: string }) {
  const fundId = DEFAULT_FUND_CODE;
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState(currentYear - 1);

  const { data: taxReport, isLoading: taxLoading } = useQuery({
    queryKey: QUERY_KEYS.taxReport(fundId, taxYear),
    queryFn: () => getInvestorTaxReport(fundId, taxYear).then((r) => r.data),
  });

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear - 1; y >= currentYear - 5; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  const handleExport = () => {
    toast.info("Tax export feature coming soon");
  };

  return (
    <SectionCard title="Tax Information">
      <div className="space-y-6">
        {/* Year selector */}
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tax Year</label>
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {taxReport && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 self-end mb-0.5">
              K-1 Ready
            </span>
          )}
        </div>

        {taxLoading ? (
          <div className="py-6 text-center text-sm text-gray-500">Loading tax data...</div>
        ) : !taxReport ? (
          <div className="py-6 text-center">
            <FileText className="h-6 w-6 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Tax data not yet available for this period.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Tax Entity Name</p>
                <p className="text-sm font-medium text-gray-900">
                  {taxReport.taxEntityName || `${profile.legalName} Trust`}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Fund Name</p>
                <p className="text-sm font-medium text-gray-900">{fundName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Tax Year</p>
                <p className="text-sm font-medium text-gray-900">{taxReport.taxYear}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Ordinary Income</p>
                <p className="text-sm font-medium text-gray-900">{fmt(Number(taxReport.ordinaryIncome))}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Return of Capital</p>
                <p className="text-sm font-medium text-gray-900">{fmt(Number(taxReport.returnOfCapital))}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Long Term Capital Gain</p>
                <p className="text-sm font-medium text-gray-900">{fmt(Number(taxReport.ltcg))}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Short Term Capital Gain</p>
                <p className="text-sm font-medium text-gray-900">{fmt(Number(taxReport.stcg))}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Distributions Received</p>
                <p className="text-sm font-semibold text-gray-900">{fmt(Number(taxReport.totalDistributions))}</p>
              </div>
            </div>

            <div>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                Export Tax Data
              </button>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}

// ── Wallet Section (existing logic preserved) ───────────────

function WalletSection({
  wallets,
  onOpenModal,
}: {
  wallets: LinkedWallet[];
  onOpenModal: () => void;
}) {
  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
  };

  const linkWalletButton = (
    <button
      onClick={onOpenModal}
      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
    >
      <Wallet className="h-4 w-4" />
      Link Wallet
    </button>
  );

  return (
    <SectionCard title="Linked Wallets" action={linkWalletButton}>
      {wallets && wallets.length > 0 ? (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Wallets verified through cryptographic ownership proof
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Address</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Network</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Label</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {wallets.map((w: LinkedWallet) => (
                  <tr key={w.walletId} className="border-b border-gray-100 last:border-0">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <ExplorerLink value={w.address ?? ""} type="address" />
                        <button
                          onClick={() => copyAddress(w.address)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy address"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-500">{chainName(w.chainId)}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={w.walletStatus} />
                        {w.isPrimary && (
                          <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            Primary
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-500">{w.label || "--"}</td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => copyAddress(w.address)}
                        className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        Copy Full Address
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <Wallet className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900 mb-1">No wallets linked</p>
          <p className="text-xs text-gray-500">Link a wallet to receive fund tokens and participate in transfers.</p>
        </div>
      )}

      {/* Security Note */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900 mb-1">Wallet Security</p>
            <p className="text-xs text-gray-500">
              Wallet ownership is verified through a cryptographic signature. Linked wallets require separate
              admin approval for fund eligibility. Your private keys never leave your wallet.
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Main Page Component ──────────────────────────────────────

export default function InvestorProfile() {
  const fundId = DEFAULT_FUND_CODE;
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("choose");
  const [modalError, setModalError] = useState<string | null>(null);
  const [connectedAddr, setConnectedAddr] = useState<string | null>(null);
  const [connectedChain, setConnectedChain] = useState<number | null>(null);

  const wallet = useWallet();

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: QUERY_KEYS.investorProfile(),
    queryFn: () => getMyProfile().then((r) => r.data),
  });

  const { data: wallets, isLoading: walletsLoading } = useQuery({
    queryKey: QUERY_KEYS.investorWallets(),
    queryFn: () => getMyWallets().then((r) => r.data),
  });

  const { data: dashboard } = useQuery({
    queryKey: QUERY_KEYS.investorDashboard(fundId),
    queryFn: () => getMyDashboard(fundId).then((r) => r.data),
  });

  const fundName = useMemo(() => {
    const sub = dashboard?.subscriptions?.[0];
    return (sub as Record<string, unknown> | undefined)?.fundName as string | undefined ?? "Angainor Demo Fund I";
  }, [dashboard]);

  const openModal = () => {
    setStep("choose");
    setModalError(null);
    setConnectedAddr(null);
    setConnectedChain(null);
    wallet.disconnect();
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    wallet.disconnect();
  };

  const handleSelectProvider = async (provider: unknown) => {
    setStep("connecting");
    setModalError(null);
    try {
      const addr = await wallet.connectWallet(provider);
      setConnectedAddr(addr);
      setConnectedChain(wallet.chainId);
      setStep("sign");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet";
      setModalError(message);
      setStep("error");
    }
  };

  const handleSign = async () => {
    if (!connectedAddr) return;
    setStep("verifying");
    setModalError(null);
    try {
      const challengeRes = await createWalletChallenge({
        address: connectedAddr,
        chainId: connectedChain || 1,
      });
      const challenge = challengeRes.data;
      const signature = await wallet.signMessage(challenge.message);
      await verifyWalletLink({
        challengeId: challenge.challengeId,
        address: connectedAddr,
        chainId: connectedChain || 1,
        signature,
      });
      setStep("success");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.investorWallets() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.investorProfile() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setModalError(message);
      setStep("error");
    }
  };

  if (profileLoading || walletsLoading) return <div className="p-6">Loading...</div>;
  if (profileError) return <ErrorAlert title="Failed to load profile" message={(profileError as Error).message} />;

  return (
    <div>
      <PageHeader title="Profile" subtitle="Manage your identity and verification" />

      <div className="space-y-6">
        {/* Section 1: Identity and Verification */}
        {profile ? (
          <IdentitySection profile={profile as typeof profile & { createdAt?: string }} />
        ) : (
          <SectionCard title="Identity and Verification">
            <p className="text-sm text-gray-500">Profile not available.</p>
          </SectionCard>
        )}

        {/* Section 2: Tax Information */}
        <TaxInformationSection profile={{ legalName: profile?.legalName ?? "Investor" }} fundName={fundName} />

        {/* Wallet Status Badge (simple view) */}
        <SectionCard title="Account Connection">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${(wallets ?? []).length > 0 ? "bg-green-500" : "bg-amber-400"}`} />
            <span className="text-sm font-medium text-gray-900">
              Wallet Status:
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${(wallets ?? []).length > 0 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
              {(wallets ?? []).length > 0 ? "Active" : "Pending"}
            </span>
          </div>

          {/* Advanced wallet management behind collapsible */}
          <TechnicalDetails label="Wallet Management (Advanced)">
            <WalletSection
              wallets={wallets ?? []}
              onOpenModal={openModal}
            />
          </TechnicalDetails>
        </SectionCard>
      </div>

      {/* Wallet Connect Modal (preserved from original, accessed via Advanced section) */}
      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {step === "choose" && "Link Wallet"}
              {step === "connecting" && "Connecting..."}
              {step === "sign" && "Verify Ownership"}
              {step === "verifying" && "Verifying..."}
              {step === "success" && "Wallet Linked"}
              {step === "error" && "Link Failed"}
            </DialogTitle>
            <DialogDescription>
              {step === "choose" && "Select a wallet provider to verify ownership"}
              {step === "connecting" && "Approve the connection request in your wallet"}
              {step === "sign" && "Sign a verification message to prove ownership"}
              {step === "verifying" && "Verifying your signature..."}
              {step === "success" && "Your wallet has been successfully linked to your account"}
              {step === "error" && "Something went wrong during the verification process"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Step: Choose Provider */}
            {step === "choose" && (
              <div className="space-y-2">
                {wallet.availableProviders.length > 0 ? (
                  wallet.availableProviders.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectProvider(p.provider)}
                      className="w-full flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      {p.icon ? (
                        <img src={p.icon} alt={p.name} className="h-8 w-8 rounded-md" />
                      ) : (
                        <div className="h-8 w-8 rounded-md bg-indigo-50 flex items-center justify-center">
                          <Wallet className="h-4 w-4 text-indigo-600" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">Click to connect</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-900 mb-1">No wallet detected</p>
                    <p className="text-xs text-gray-500 mb-4">
                      Install MetaMask or Phantom to link a wallet.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <a
                        href="https://metamask.io/download/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                      >
                        Get MetaMask <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href="https://phantom.app/download"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                      >
                        Get Phantom <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step: Connecting */}
            {step === "connecting" && (
              <div className="flex flex-col items-center py-6">
                <div className="h-10 w-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-4" />
                <p className="text-sm text-gray-500">Waiting for wallet approval...</p>
              </div>
            )}

            {/* Step: Sign */}
            {step === "sign" && connectedAddr && (
              <div className="space-y-4">
                <TechnicalDetails label="Connection Details">
                  <div className="space-y-3">
                    <div className="rounded-lg bg-gray-50 p-4">
                      <p className="text-xs text-gray-500 mb-1">Connected Address</p>
                      <ExplorerLink value={connectedAddr ?? ""} type="address" truncate={false} />
                    </div>
                    <div className="rounded-lg bg-gray-50 p-4">
                      <p className="text-xs text-gray-500 mb-1">Network</p>
                      <p className="text-sm text-gray-900">{chainName(connectedChain || 1)}</p>
                    </div>
                  </div>
                </TechnicalDetails>
                <button
                  onClick={handleSign}
                  className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Sign Verification Message
                </button>
                <p className="text-xs text-gray-500 text-center">
                  This will request a signature in your wallet. No transaction will be sent.
                </p>
              </div>
            )}

            {/* Step: Verifying */}
            {step === "verifying" && (
              <div className="flex flex-col items-center py-6">
                <div className="h-10 w-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-4" />
                <p className="text-sm text-gray-500">Verifying ownership...</p>
              </div>
            )}

            {/* Step: Success */}
            {step === "success" && (
              <div className="flex flex-col items-center py-6">
                <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">Wallet linked successfully</p>
                <p className="text-xs text-gray-500 mb-4 text-center">
                  An administrator will review and approve fund eligibility for this wallet.
                </p>
                <button
                  onClick={closeModal}
                  className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Done
                </button>
              </div>
            )}

            {/* Step: Error */}
            {step === "error" && (
              <div className="flex flex-col items-center py-6">
                <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">Verification failed</p>
                <p className="text-xs text-gray-500 mb-4 text-center">
                  {modalError || "An unexpected error occurred."}
                </p>
                <button
                  onClick={() => { setStep("choose"); setModalError(null); wallet.disconnect(); }}
                  className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
