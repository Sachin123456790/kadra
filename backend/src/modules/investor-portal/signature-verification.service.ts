import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { randomBytes } from 'crypto';

export interface ChallengePayload {
  appName: string;
  authUserId: string;
  walletAddress: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

@Injectable()
export class SignatureVerificationService {
  buildChallengeMessage(payload: ChallengePayload): string {
    return [
      `${payload.appName} Wallet Verification`,
      '',
      `I am linking wallet ${payload.walletAddress} to my ${payload.appName} account.`,
      '',
      `Account: ${payload.authUserId}`,
      `Chain ID: ${payload.chainId}`,
      `Nonce: ${payload.nonce}`,
      `Issued: ${payload.issuedAt}`,
      `Expires: ${payload.expiresAt}`,
    ].join('\n');
  }

  recoverAddress(message: string, signature: string): string {
    return ethers.verifyMessage(message, signature);
  }

  isValidSignature(
    message: string,
    signature: string,
    expectedAddress: string,
  ): boolean {
    try {
      const recovered = this.recoverAddress(message, signature);
      return recovered.toLowerCase() === expectedAddress.toLowerCase();
    } catch {
      return false;
    }
  }

  generateNonce(): string {
    return randomBytes(32).toString('hex');
  }
}
