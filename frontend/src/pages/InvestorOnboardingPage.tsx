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
    title: "Link your wallet",
    subtitle: "Your wallet will hold fund ownership tokens.",
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
                    Link a wallet via MetaMask or Phantom
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
                  Link the wallet that will hold your fund ownership tokens. We
                  ask you to sign a one-time message to prove you control the
                  address — no transaction fees, no on-chain writes.
                </p>

                {wallet.availableProviders.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    No wallet extension detected. Install MetaMask or Phantom
                    and reload this page.
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
                    onClick={handleLinkWallet}
                    disabled={
                      walletLinking || wallet.availableProviders.length === 0
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
