import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { QUERY_KEYS } from "@/config/constants";
import { getMyProfile, getMyWallets, createWalletChallenge, verifyWalletLink } from "@/services";
import type { LinkedWallet } from "@/services/wallet-profile.service";
import { useWallet } from "@/hooks/useWallet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Wallet, CheckCircle, AlertCircle, Copy, ExternalLink, Shield } from "lucide-react";

const truncAddr = (addr: string) =>
  addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

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

type ModalStep = "choose" | "connecting" | "sign" | "verifying" | "success" | "error";

export default function InvestorProfile() {
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

  const { data: wallets, isLoading: walletsLoading, error: walletsError } = useQuery({
    queryKey: QUERY_KEYS.investorWallets(),
    queryFn: () => getMyWallets().then((r) => r.data),
  });

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
      // Request challenge from backend
      const challengeRes = await createWalletChallenge({
        address: connectedAddr,
        chainId: connectedChain || 1,
      });
      const challenge = challengeRes.data;

      // Sign the challenge message
      const signature = await wallet.signMessage(challenge.message);

      // Verify with backend
      await verifyWalletLink({
        challengeId: challenge.challengeId,
        address: connectedAddr,
        chainId: connectedChain || 1,
        signature,
      });

      setStep("success");
      // Refresh wallet list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.investorWallets() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.investorProfile() });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Verification failed";
      setModalError(message);
      setStep("error");
    }
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
  };

  if (profileLoading || walletsLoading) return <div className="p-6">Loading...</div>;
  if (profileError) return <ErrorAlert title="Failed to load profile" message={(profileError as Error).message} />;

  const linkWalletButton = (
    <button
      onClick={openModal}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      <Wallet className="h-4 w-4" />
      Link Wallet
    </button>
  );

  return (
    <div>
      <PageHeader title="Profile & Wallets" subtitle="Manage your identity and linked wallets" />

      {/* Identity Summary */}
      <SectionCard title="Identity" className="mb-6">
        {profile ? (
          <dl className="space-y-3">
            {([
              ["Legal Name", profile.legalName],
              ["Email", profile.email],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="text-sm font-medium text-card-foreground">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-sm text-muted-foreground">Verification Status</dt>
              <dd><StatusBadge status={profile.verificationStatus} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">Linked Wallets</dt>
              <dd className="text-sm font-medium text-card-foreground">{profile.walletCount}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Profile not available.</p>
        )}
      </SectionCard>

      {/* Linked Wallets */}
      <SectionCard title="Linked Wallets" className="mb-6" action={linkWalletButton}>
        {wallets && wallets.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Wallets verified through cryptographic ownership proof
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Address</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Network</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Label</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((w: LinkedWallet) => (
                    <tr key={w.walletId} className="border-b border-border last:border-0">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{truncAddr(w.address)}</span>
                          <button
                            onClick={() => copyAddress(w.address)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy address"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{chainName(w.chainId)}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={w.walletStatus} />
                          {w.isPrimary && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              Primary
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{w.label || "--"}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => copyAddress(w.address)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
            <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-card-foreground mb-1">No wallets linked</p>
            <p className="text-xs text-muted-foreground">Link a wallet to receive fund tokens and participate in transfers.</p>
          </div>
        )}
      </SectionCard>

      {/* Security Note */}
      <SectionCard>
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-card-foreground mb-1">Wallet Security</p>
            <p className="text-xs text-muted-foreground">
              Wallet ownership is verified through a cryptographic signature. Linked wallets require separate
              admin approval for fund eligibility. Your private keys never leave your wallet.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Wallet Connect Modal */}
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
                      className="w-full flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted transition-colors text-left"
                    >
                      {p.icon ? (
                        <img src={p.icon} alt={p.name} className="h-8 w-8 rounded-md" />
                      ) : (
                        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                          <Wallet className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">Click to connect</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium mb-1">No wallet detected</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Install MetaMask or Phantom to link a wallet.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <a
                        href="https://metamask.io/download/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Get MetaMask <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href="https://phantom.app/download"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
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
                <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">Waiting for wallet approval...</p>
              </div>
            )}

            {/* Step: Sign */}
            {step === "sign" && connectedAddr && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-xs text-muted-foreground mb-1">Connected Address</p>
                  <p className="font-mono text-sm break-all">{connectedAddr}</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-xs text-muted-foreground mb-1">Network</p>
                  <p className="text-sm">{chainName(connectedChain || 1)}</p>
                </div>
                <button
                  onClick={handleSign}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Sign Verification Message
                </button>
                <p className="text-xs text-muted-foreground text-center">
                  This will request a signature in your wallet. No transaction will be sent.
                </p>
              </div>
            )}

            {/* Step: Verifying */}
            {step === "verifying" && (
              <div className="flex flex-col items-center py-6">
                <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">Verifying ownership...</p>
              </div>
            )}

            {/* Step: Success */}
            {step === "success" && (
              <div className="flex flex-col items-center py-6">
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <p className="text-sm font-medium mb-1">Wallet linked successfully</p>
                <p className="text-xs text-muted-foreground mb-4 text-center">
                  An administrator will review and approve fund eligibility for this wallet.
                </p>
                <button
                  onClick={closeModal}
                  className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Done
                </button>
              </div>
            )}

            {/* Step: Error */}
            {step === "error" && (
              <div className="flex flex-col items-center py-6">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-sm font-medium mb-1">Verification failed</p>
                <p className="text-xs text-muted-foreground mb-4 text-center">
                  {modalError || "An unexpected error occurred."}
                </p>
                <button
                  onClick={() => { setStep("choose"); setModalError(null); wallet.disconnect(); }}
                  className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
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
