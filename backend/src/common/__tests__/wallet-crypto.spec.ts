import {
  generateCustodialWallet,
  encryptPrivateKey,
  decryptPrivateKey,
} from '../wallet-crypto';

describe('wallet-crypto', () => {
  const ORIGINAL_KEY = process.env.WALLET_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.WALLET_ENCRYPTION_KEY =
      'test-secret-min-16-chars-for-jest-only';
  });

  afterAll(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.WALLET_ENCRYPTION_KEY;
    } else {
      process.env.WALLET_ENCRYPTION_KEY = ORIGINAL_KEY;
    }
  });

  it('generates a checksummed Ethereum address with matching private key', () => {
    const { address, privateKey } = generateCustodialWallet();
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it('round-trips through AES-256-GCM encryption', () => {
    const { privateKey } = generateCustodialWallet();
    const encrypted = encryptPrivateKey(privateKey);
    expect(encrypted).not.toContain(privateKey);
    expect(decryptPrivateKey(encrypted)).toBe(privateKey);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const { privateKey } = generateCustodialWallet();
    const a = encryptPrivateKey(privateKey);
    const b = encryptPrivateKey(privateKey);
    expect(a).not.toBe(b);
    expect(decryptPrivateKey(a)).toBe(decryptPrivateKey(b));
  });

  it('throws when WALLET_ENCRYPTION_KEY is missing', () => {
    const prev = process.env.WALLET_ENCRYPTION_KEY;
    delete process.env.WALLET_ENCRYPTION_KEY;
    try {
      expect(() => encryptPrivateKey('0xabc')).toThrow(
        /WALLET_ENCRYPTION_KEY/,
      );
    } finally {
      process.env.WALLET_ENCRYPTION_KEY = prev;
    }
  });
});
