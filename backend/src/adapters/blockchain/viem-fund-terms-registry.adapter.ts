import { Injectable } from '@nestjs/common';
import { ViemClientProvider } from './viem-client.provider';
import { FUND_TERMS_REGISTRY_ABI } from './abi/fund-terms-registry.abi';
import { type Address, keccak256, toHex } from 'viem';

export interface FundTermsRegistryAdapter {
  setStringTerm(
    fundId: string,
    key: string,
    value: string,
    sourceDocHash: `0x${string}`,
  ): Promise<{ txHash: string }>;

  setUintTerm(
    fundId: string,
    key: string,
    value: bigint,
    sourceDocHash: `0x${string}`,
  ): Promise<{ txHash: string }>;

  /**
   * Write all extracted fields on-chain in as few transactions as possible.
   * Returns tx hashes for each field written.
   */
  writeExtractedFields(
    fundId: string,
    fields: Array<{
      fieldName: string;
      fieldValueText?: string | null;
      fieldValueNumeric?: number | null;
    }>,
    sourceDocHash: `0x${string}`,
  ): Promise<{ txHashes: string[]; fieldsWritten: number }>;
}

export const FUND_TERMS_REGISTRY_ADAPTER = Symbol(
  'FUND_TERMS_REGISTRY_ADAPTER',
);

@Injectable()
export class ViemFundTermsRegistryAdapter
  implements FundTermsRegistryAdapter
{
  private readonly contractAddress: Address;

  constructor(private readonly viem: ViemClientProvider) {
    const addr = process.env.FUND_TERMS_REGISTRY_ADDRESS;
    if (!addr) {
      throw new Error(
        'FUND_TERMS_REGISTRY_ADDRESS env var required — deploy contract first',
      );
    }
    this.contractAddress = addr as Address;
  }

  async setStringTerm(
    fundId: string,
    key: string,
    value: string,
    sourceDocHash: `0x${string}`,
  ): Promise<{ txHash: string }> {
    const fundIdHash = keccak256(toHex(fundId));
    const hash = await this.viem.deployerWalletClient.writeContract({
      address: this.contractAddress,
      abi: FUND_TERMS_REGISTRY_ABI,
      functionName: 'setStringTerm',
      args: [fundIdHash, key, value, sourceDocHash],
    });
    await this.viem.publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });
    return { txHash: hash };
  }

  async setUintTerm(
    fundId: string,
    key: string,
    value: bigint,
    sourceDocHash: `0x${string}`,
  ): Promise<{ txHash: string }> {
    const fundIdHash = keccak256(toHex(fundId));
    const hash = await this.viem.deployerWalletClient.writeContract({
      address: this.contractAddress,
      abi: FUND_TERMS_REGISTRY_ABI,
      functionName: 'setUintTerm',
      args: [fundIdHash, key, value, sourceDocHash],
    });
    await this.viem.publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });
    return { txHash: hash };
  }

  async writeExtractedFields(
    fundId: string,
    fields: Array<{
      fieldName: string;
      fieldValueText?: string | null;
      fieldValueNumeric?: number | null;
    }>,
    sourceDocHash: `0x${string}`,
  ): Promise<{ txHashes: string[]; fieldsWritten: number }> {
    const txHashes: string[] = [];
    const fundIdHash = keccak256(toHex(fundId));

    for (const field of fields) {
      try {
        // Use uint for numeric fields, string for text fields
        if (field.fieldValueNumeric != null) {
          const hash = await this.viem.deployerWalletClient.writeContract({
            address: this.contractAddress,
            abi: FUND_TERMS_REGISTRY_ABI,
            functionName: 'setUintTerm',
            args: [
              fundIdHash,
              field.fieldName,
              BigInt(Math.round(field.fieldValueNumeric)),
              sourceDocHash,
            ],
          });
          // Don't wait for receipt per-field to save time; wait at end
          txHashes.push(hash);
        } else if (field.fieldValueText) {
          const hash = await this.viem.deployerWalletClient.writeContract({
            address: this.contractAddress,
            abi: FUND_TERMS_REGISTRY_ABI,
            functionName: 'setStringTerm',
            args: [
              fundIdHash,
              field.fieldName,
              field.fieldValueText,
              sourceDocHash,
            ],
          });
          txHashes.push(hash);
        }
      } catch (e) {
        console.warn(`Failed to write field ${field.fieldName} on-chain:`, e);
      }
    }

    // Wait for the last tx to confirm (all prior should be confirmed by then)
    if (txHashes.length > 0) {
      await this.viem.publicClient.waitForTransactionReceipt({
        hash: txHashes[txHashes.length - 1] as `0x${string}`,
        timeout: 60_000,
      });
    }

    return { txHashes, fieldsWritten: txHashes.length };
  }
}
