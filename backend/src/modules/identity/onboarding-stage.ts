/**
 * Pure helpers to derive an investor's onboarding stage from their existing
 * Investor, Wallet, and InvestorFundEligibility rows. No new DB columns.
 *
 * Used by both:
 *  - Admin investor list/detail (to show "stuck on" banners per investor)
 *  - Investor-self endpoints (to drive the wizard client-side)
 */

export type OnboardingStageKey =
  | 'account'
  | 'profile'
  | 'kyc'
  | 'accreditation'
  | 'wallet'
  | 'eligibility';

export interface OnboardingStageStatus {
  readonly key: OnboardingStageKey;
  readonly order: number;
  readonly label: string;
  readonly state: 'complete' | 'current' | 'pending' | 'blocked';
  readonly actor: 'investor' | 'admin' | 'system';
  readonly hint?: string;
}

export interface OnboardingSummary {
  readonly stages: readonly OnboardingStageStatus[];
  readonly currentStage: OnboardingStageKey | null;
  readonly blockedOn: OnboardingStageKey | null;
  readonly completed: boolean;
  readonly percentComplete: number;
}

interface InvestorLike {
  readonly id: string;
  readonly legalName: string;
  readonly email: string | null;
  readonly verificationStatus: string;
  readonly kycStatus: string;
  readonly accreditationStatus: string;
  readonly metadata: unknown;
}

interface WalletLike {
  readonly walletStatus: string;
  readonly walletSource: string;
}

interface EligibilityLike {
  readonly eligibilityStatus: string;
}

const STAGE_LABELS: Record<OnboardingStageKey, string> = {
  account: 'Account created',
  profile: 'Profile & tax info',
  kyc: 'KYC verified',
  accreditation: 'Accreditation confirmed',
  wallet: 'Wallet linked',
  eligibility: 'Fund eligibility approved',
};

const STAGE_ACTOR: Record<OnboardingStageKey, 'investor' | 'admin' | 'system'> =
  {
    account: 'system',
    profile: 'investor',
    kyc: 'admin',
    accreditation: 'admin',
    wallet: 'investor',
    eligibility: 'admin',
  };

function isProfileComplete(investor: InvestorLike): boolean {
  const meta = (investor.metadata ?? {}) as Record<string, unknown>;
  return meta.profileCompleted === true;
}

function isKycApproved(investor: InvestorLike): boolean {
  return investor.kycStatus === 'APPROVED';
}

function isAccreditationApproved(investor: InvestorLike): boolean {
  return investor.accreditationStatus === 'APPROVED';
}

function hasLinkedWallet(wallets: readonly WalletLike[]): boolean {
  return wallets.some(
    (w) => w.walletStatus === 'ACTIVE' && w.walletSource !== 'SYSTEM_GENERATED',
  );
}

function hasApprovedEligibility(
  eligibilities: readonly EligibilityLike[],
): boolean {
  return eligibilities.some((e) => e.eligibilityStatus === 'ELIGIBLE');
}

export function computeOnboardingStage(input: {
  readonly investor: InvestorLike;
  readonly wallets: readonly WalletLike[];
  readonly eligibilities: readonly EligibilityLike[];
}): OnboardingSummary {
  const { investor, wallets, eligibilities } = input;

  const checks: Record<OnboardingStageKey, boolean> = {
    account: true,
    profile: isProfileComplete(investor),
    kyc: isKycApproved(investor),
    accreditation: isAccreditationApproved(investor),
    wallet: hasLinkedWallet(wallets),
    eligibility: hasApprovedEligibility(eligibilities),
  };

  const ORDER: readonly OnboardingStageKey[] = [
    'account',
    'profile',
    'kyc',
    'accreditation',
    'wallet',
    'eligibility',
  ];

  // First incomplete stage is the current one; everything after is pending.
  const firstIncomplete = ORDER.find((k) => !checks[k]) ?? null;

  const stages: OnboardingStageStatus[] = ORDER.map((key, idx) => {
    let state: OnboardingStageStatus['state'];
    if (checks[key]) {
      state = 'complete';
    } else if (key === firstIncomplete) {
      state = 'current';
    } else {
      state = 'pending';
    }
    return {
      key,
      order: idx + 1,
      label: STAGE_LABELS[key],
      actor: STAGE_ACTOR[key],
      state,
    };
  });

  const completedCount = stages.filter((s) => s.state === 'complete').length;

  return {
    stages,
    currentStage: firstIncomplete,
    blockedOn: firstIncomplete,
    completed: firstIncomplete === null,
    percentComplete: Math.round((completedCount / ORDER.length) * 100),
  };
}
