import { computeOnboardingStage } from '../onboarding-stage';

// Minimal shape mirroring the fields the helper reads.
const baseInvestor = {
  id: 'inv-1',
  legalName: 'Jane Doe',
  email: 'jane@example.com',
  verificationStatus: 'UNKNOWN',
  kycStatus: 'PENDING',
  accreditationStatus: 'PENDING',
  metadata: {},
};

describe('computeOnboardingStage', () => {
  it('fresh signup: stuck on profile, 1/6 complete', () => {
    const result = computeOnboardingStage({
      investor: baseInvestor,
      wallets: [],
      eligibilities: [],
    });
    expect(result.completed).toBe(false);
    expect(result.blockedOn).toBe('profile');
    expect(result.percentComplete).toBe(Math.round((1 / 6) * 100));
    expect(result.stages[0].state).toBe('complete'); // account
    expect(result.stages[1].state).toBe('current'); // profile
  });

  it('profile done: stuck on KYC', () => {
    const result = computeOnboardingStage({
      investor: {
        ...baseInvestor,
        metadata: { profileCompleted: true, country: 'US' },
      },
      wallets: [],
      eligibilities: [],
    });
    expect(result.blockedOn).toBe('kyc');
    expect(result.stages[1].state).toBe('complete');
    expect(result.stages[2].state).toBe('current');
  });

  it('country alone does not mark profile complete', () => {
    const result = computeOnboardingStage({
      investor: {
        ...baseInvestor,
        metadata: { country: 'US', taxId: '12-3456789' },
      },
      wallets: [],
      eligibilities: [],
    });
    expect(result.completed).toBe(false);
    expect(result.blockedOn).toBe('profile');
    expect(result.stages[1].state).toBe('current');
  });

  it('KYC approved: stuck on accreditation', () => {
    const result = computeOnboardingStage({
      investor: {
        ...baseInvestor,
        metadata: { profileCompleted: true },
        kycStatus: 'APPROVED',
      },
      wallets: [],
      eligibilities: [],
    });
    expect(result.blockedOn).toBe('accreditation');
  });

  it('accreditation approved: stuck on wallet', () => {
    const result = computeOnboardingStage({
      investor: {
        ...baseInvestor,
        metadata: { profileCompleted: true },
        kycStatus: 'APPROVED',
        accreditationStatus: 'APPROVED',
      },
      wallets: [],
      eligibilities: [],
    });
    expect(result.blockedOn).toBe('wallet');
  });

  it('wallet linked: stuck on eligibility', () => {
    const result = computeOnboardingStage({
      investor: {
        ...baseInvestor,
        metadata: { profileCompleted: true },
        kycStatus: 'APPROVED',
        accreditationStatus: 'APPROVED',
      },
      wallets: [{ walletStatus: 'ACTIVE', walletSource: 'METAMASK' }],
      eligibilities: [],
    });
    expect(result.blockedOn).toBe('eligibility');
  });

  it('eligibility approved: fully onboarded', () => {
    const result = computeOnboardingStage({
      investor: {
        ...baseInvestor,
        metadata: { profileCompleted: true },
        kycStatus: 'APPROVED',
        accreditationStatus: 'APPROVED',
      },
      wallets: [{ walletStatus: 'ACTIVE', walletSource: 'METAMASK' }],
      eligibilities: [{ eligibilityStatus: 'ELIGIBLE' }],
    });
    expect(result.completed).toBe(true);
    expect(result.blockedOn).toBeNull();
    expect(result.percentComplete).toBe(100);
    expect(result.stages.every((s) => s.state === 'complete')).toBe(true);
  });

  it('verificationStatus=VERIFIED does not short-circuit profile, KYC, or accreditation', () => {
    const result = computeOnboardingStage({
      investor: {
        ...baseInvestor,
        verificationStatus: 'VERIFIED',
      },
      wallets: [{ walletStatus: 'ACTIVE', walletSource: 'SEED' }],
      eligibilities: [{ eligibilityStatus: 'ELIGIBLE' }],
    });
    expect(result.completed).toBe(false);
    expect(result.blockedOn).toBe('profile');
    expect(result.stages[1].state).toBe('current');
    expect(result.stages[2].state).toBe('pending');
    expect(result.stages[3].state).toBe('pending');
  });

  it('SYSTEM_GENERATED wallet does not satisfy wallet stage', () => {
    const result = computeOnboardingStage({
      investor: {
        ...baseInvestor,
        metadata: { profileCompleted: true },
        kycStatus: 'APPROVED',
        accreditationStatus: 'APPROVED',
      },
      wallets: [{ walletStatus: 'ACTIVE', walletSource: 'SYSTEM_GENERATED' }],
      eligibilities: [],
    });
    expect(result.blockedOn).toBe('wallet');
  });

  it('blocked wallet (INACTIVE) does not satisfy wallet stage', () => {
    const result = computeOnboardingStage({
      investor: {
        ...baseInvestor,
        metadata: { profileCompleted: true },
        kycStatus: 'APPROVED',
        accreditationStatus: 'APPROVED',
      },
      wallets: [{ walletStatus: 'INACTIVE', walletSource: 'METAMASK' }],
      eligibilities: [],
    });
    expect(result.blockedOn).toBe('wallet');
  });

  it('revoked eligibility does not satisfy eligibility stage', () => {
    const result = computeOnboardingStage({
      investor: {
        ...baseInvestor,
        metadata: { profileCompleted: true },
        kycStatus: 'APPROVED',
        accreditationStatus: 'APPROVED',
      },
      wallets: [{ walletStatus: 'ACTIVE', walletSource: 'METAMASK' }],
      eligibilities: [{ eligibilityStatus: 'REVOKED' }],
    });
    expect(result.blockedOn).toBe('eligibility');
  });

  it('returns stages in canonical order', () => {
    const result = computeOnboardingStage({
      investor: baseInvestor,
      wallets: [],
      eligibilities: [],
    });
    expect(result.stages.map((s) => s.key)).toEqual([
      'account',
      'profile',
      'kyc',
      'accreditation',
      'wallet',
      'eligibility',
    ]);
    expect(result.stages.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('stage.actor correctly attributes each stage', () => {
    const result = computeOnboardingStage({
      investor: baseInvestor,
      wallets: [],
      eligibilities: [],
    });
    const actors = Object.fromEntries(result.stages.map((s) => [s.key, s.actor]));
    expect(actors.account).toBe('system');
    expect(actors.profile).toBe('investor');
    expect(actors.kyc).toBe('admin');
    expect(actors.accreditation).toBe('admin');
    expect(actors.wallet).toBe('investor');
    expect(actors.eligibility).toBe('admin');
  });
});
