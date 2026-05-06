import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
  UserRound,
  Wallet as WalletIcon,
} from "lucide-react";
import { PageHeader } from "@/components/angainor/PageHeader";
import { SectionCard } from "@/components/angainor/SectionCard";
import { OnboardingStages } from "@/components/angainor/OnboardingStages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import {
  getMyOnboarding,
  updateMyProfile,
} from "@/services/onboarding.service";
import {
  autoGenerateMyWallet,
  createWalletChallenge,
  verifyWalletLink,
} from "@/services/wallet-profile.service";
import { ROUTES } from "@/config/constants";

type WizardStep = "welcome" | "profile" | "wallet" | "review";

const STEP_ORDER: readonly WizardStep[] = [
  "welcome",
  "profile",
  "wallet",
  "review",
];

const STEP_META: Record<WizardStep, { title: string; subtitle: string }> = {
  welcome: {
    title: "Welcome to Angainor",
    subtitle: "Let's get your investor account set up in 3 steps.",
  },
  profile: {
    title: "Your profile",
    subtitle: "Confirm your legal information for fund records.",
  },
  wallet: {
    title: "Set up your wallet",
    subtitle:
      "Generate a custodial wallet in one click, or connect your own.",
  },
  review: {
    title: "You're all set",
    subtitle:
      "We'll review your account. You'll be notified when your fund eligibility is approved.",
  },
};

export default function InvestorOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WizardStep>("welcome");

  // Profile step form state
  const [legalName, setLegalName] = useState(user?.fullName ?? "");
  const [country, setCountry] = useState("");
  const [taxId, setTaxId] = useState("");
  const [sourceOfIncome, setSourceOfIncome] = useState("");

  const { data: onboarding, isLoading } = useQuery({
    queryKey: ["investor", "onboarding"],
    queryFn: () => getMyOnboarding().then((r) => r.data),
  });

  // Resume from where the investor left off: if profile is done but wallet
  // isn't, jump to wallet; if both are done, jump to review. Only do this on
  // first load — subsequent setStep() calls (Back, etc.) are user-initiated
  // and must not be overridden by re-syncs.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !onboarding) return;
    resumedRef.current = true;
    const stageState = (key: string) =>
      onboarding.stages.find((s) => s.key === key)?.state;
    const profileDone = stageState("profile") === "complete";
    const walletDone = stageState("wallet") === "complete";
    if (profileDone && walletDone) {
      setStep("review");
    } else if (profileDone) {
      setStep("wallet");
    }
  }, [onboarding]);

  const profileMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investor", "onboarding"] });
      toast.success("Profile saved");
      setStep("wallet");
    },
    onError: (err: Error) =>
      toast.error(`Could not save profile: ${err.message}`),
  });

  const wallet = useWallet();
  const [walletLinking, setWalletLinking] = useState(false);
  const [walletAutoGenerating, setWalletAutoGenerating] = useState(false);
  const [generatedAddress, setGeneratedAddress] = useState<string | null>(null);

  const handleAutoGenerateWallet = async () => {
    try {
      setWalletAutoGenerating(true);
      const res = await autoGenerateMyWallet({});
      setGeneratedAddress(res.data.address);
      queryClient.invalidateQueries({ queryKey: ["investor", "onboarding"] });
      toast.success("Custodial wallet created");
      setStep("review");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Could not generate wallet: ${message}`);
    } finally {
      setWalletAutoGenerating(false);
    }
  };

  const handleLinkWallet = async () => {
    try {
      setWalletLinking(true);
      const { address, chainId } = await wallet.connectWallet();
      const challenge = await createWalletChallenge({ address, chainId });
      const signature = await wallet.signMessage(challenge.data.message);
      await verifyWalletLink({
        challengeId: challenge.data.challengeId,
        address,
        chainId,
        signature,
      });
      queryClient.invalidateQueries({ queryKey: ["investor", "onboarding"] });
      toast.success("Wallet linked");
      setStep("review");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Wallet link failed: ${message}`);
    } finally {
      setWalletLinking(false);
    }
  };

  const stepIndex = STEP_ORDER.indexOf(step);
  const canGoBack = stepIndex > 0 && step !== "review";

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!legalName.trim() || !country || !taxId.trim()) {
      toast.error("Please fill in name, country, and tax ID");
      return;
    }
    profileMutation.mutate({
      legalName: legalName.trim(),
      country,
      taxId: taxId.trim(),
      sourceOfIncome,
    });
  }

  return (
    <div>
      <PageHeader
        title={STEP_META[step].title}
        subtitle={STEP_META[step].subtitle}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main wizard */}
        <div className="lg:col-span-2">
          <SectionCard>
            {step === "welcome" && (
              <div className="p-2">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  You're signed in as {user?.email}
                </h2>
                <p className="text-sm text-muted-foreground mb-6">
                  To finish setting up your investor account, we need to collect
                  a few details. Your admin will review and approve your account
                  before you can hold fund ownership.
                </p>
                <ul className="space-y-2 mb-8 text-sm text-foreground">
                  <li className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-primary" />
                    Confirm your legal profile (~1 min)
                  </li>
                  <li className="flex items-center gap-2">
                    <WalletIcon className="h-4 w-4 text-primary" />
                    Get a custodial wallet (or connect MetaMask / Phantom)
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Wait for admin KYC, accreditation, and eligibility approval
                  </li>
                </ul>
                <Button
                  onClick={() => setStep("profile")}
                  className="w-full sm:w-auto"
                >
                  Get started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}

            {step === "profile" && (
              <form onSubmit={handleProfileSubmit} className="space-y-4 p-2">
                <div>
                  <Label htmlFor="legalName">Legal name</Label>
                  <Input
                    id="legalName"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    As it appears on your government ID or entity formation docs.
                  </p>
                </div>

                <div>
                  <Label htmlFor="country">Country of residence</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger id="country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="AU">Australia</SelectItem>
                      <SelectItem value="SG">Singapore</SelectItem>
                      <SelectItem value="DE">Germany</SelectItem>
                      <SelectItem value="CH">Switzerland</SelectItem>
                      <SelectItem value="AE">UAE</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="taxId">Tax ID / SSN / EIN</Label>
                  <Input
                    id="taxId"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="XXX-XX-XXXX"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="sourceOfIncome">Source of income</Label>
                  <Select
                    value={sourceOfIncome}
                    onValueChange={setSourceOfIncome}
                  >
                    <SelectTrigger id="sourceOfIncome">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SALARY">Salary / W-2</SelectItem>
                      <SelectItem value="BUSINESS">Business income</SelectItem>
                      <SelectItem value="INVESTMENTS">
                        Investment income
                      </SelectItem>
                      <SelectItem value="INHERITANCE">Inheritance</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("welcome")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button type="submit" disabled={profileMutation.isPending}>
                    {profileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Save & continue
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}

            {step === "wallet" && (
              <div className="p-2 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your wallet holds the fund ownership tokens. The fastest path
                  is to let Angainor generate a custodial wallet for you — no
                  browser extension, no setup. You can always connect your own
                  wallet later from Profile.
                </p>

                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">
                        Recommended: generate a wallet for me
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Angainor will create a Sepolia testnet wallet and
                        securely manage signing on your behalf. Best for
                        first-time investors.
                      </p>
                    </div>
                  </div>
                  {generatedAddress && (
                    <div className="rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground break-all">
                      {generatedAddress}
                    </div>
                  )}
                  <Button
                    onClick={handleAutoGenerateWallet}
                    disabled={walletAutoGenerating || walletLinking}
                    className="w-full"
                  >
                    {walletAutoGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <WalletIcon className="mr-2 h-4 w-4" />
                        Generate wallet for me
                      </>
                    )}
                  </Button>
                </div>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wider">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or connect your own
                    </span>
                  </div>
                </div>

                {wallet.availableProviders.length === 0 ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
                    No wallet extension detected. Install MetaMask or Phantom
                    to connect an existing wallet.
                  </div>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <div className="text-xs text-muted-foreground mb-2">
                      Available wallets
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {wallet.availableProviders.map((p) => (
                        <span
                          key={p.name}
                          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground"
                        >
                          <WalletIcon className="h-3.5 w-3.5 text-primary" />
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {wallet.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {wallet.error}
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("profile")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleLinkWallet}
                    disabled={
                      walletLinking ||
                      walletAutoGenerating ||
                      wallet.availableProviders.length === 0
                    }
                  >
                    {walletLinking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <WalletIcon className="mr-2 h-4 w-4" />
                        Connect & sign
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="p-2 text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-7 w-7 text-green-700" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Your account is pending admin review
                </h2>
                <p className="mx-auto max-w-md text-sm text-muted-foreground mb-6">
                  You'll receive a notification when your admin approves your
                  KYC, accreditation, and fund eligibility. Typical turnaround is
                  under 24 hours.
                </p>
                <Button
                  onClick={() => navigate(ROUTES.INVESTOR_DASHBOARD)}
                >
                  Go to dashboard
                </Button>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Stepper rail */}
        <div>
          <SectionCard>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Your progress
            </h3>
            {isLoading || !onboarding ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <OnboardingStages summary={onboarding} mode="investor" />
            )}
          </SectionCard>
        </div>
      </div>

      {canGoBack && null}
    </div>
  );
}
