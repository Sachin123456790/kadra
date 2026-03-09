import { Injectable } from '@nestjs/common';
import { ViemClientProvider } from './viem-client.provider';
import { DOCUMENT_REGISTRY_ABI } from './abi/document-registry.abi';
import { type Address } from 'viem';

export interface DocumentRegistryAdapter {
  registerDocument(
    docHash: `0x${string}`,
    docType: string,
  ): Promise<{ txHash: string; blockNumber: number }>;
  documentExists(docHash: `0x${string}`): Promise<boolean>;
}

export const DOCUMENT_REGISTRY_ADAPTER = Symbol('DOCUMENT_REGISTRY_ADAPTER');

@Injectable()
export class ViemDocumentRegistryAdapter implements DocumentRegistryAdapter {
  private readonly contractAddress: Address;

  constructor(private readonly viem: ViemClientProvider) {
    const addr = process.env.DOCUMENT_REGISTRY_ADDRESS;
    if (!addr) {
      throw new Error(
        'DOCUMENT_REGISTRY_ADDRESS env var required — deploy contracts first',
      );
    }
    this.contractAddress = addr as Address;
  }

  async documentExists(docHash: `0x${string}`): Promise<boolean> {
    const result = await this.viem.publicClient.readContract({
      address: this.contractAddress,
      abi: DOCUMENT_REGISTRY_ABI,
      functionName: 'documentExists',
      args: [docHash],
    });
    return result as boolean;
  }

  async registerDocument(
    docHash: `0x${string}`,
    docType: string,
  ): Promise<{ txHash: string; blockNumber: number }> {
    // Check if already registered (contract reverts on duplicates)
    const exists = await this.documentExists(docHash);
    if (exists) {
      // Already anchored — fetch the existing data
      const blockNumber = await this.viem.publicClient.getBlockNumber();
      return {
        txHash: 'already-anchored',
        blockNumber: Number(blockNumber),
      };
    }

    const hash = await this.viem.deployerWalletClient.writeContract({
      address: this.contractAddress,
      abi: DOCUMENT_REGISTRY_ABI,
      functionName: 'registerDocument',
      args: [docHash, docType],
    });

    const receipt = await this.viem.publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });

    return {
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
    };
  }
}
