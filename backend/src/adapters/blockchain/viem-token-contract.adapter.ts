import { Injectable } from '@nestjs/common';
import {
  TokenContractAdapter,
  DeployInput,
  MintInput,
  TransferInput,
} from './token-contract.adapter';
import { ViemClientProvider } from './viem-client.provider';
import { KADRA_TOKEN_ABI } from './abi/kadra-token.abi';
import { parseUnits, formatUnits, type Address } from 'viem';

@Injectable()
export class ViemTokenContractAdapter implements TokenContractAdapter {
  constructor(private readonly viem: ViemClientProvider) {}

  async deploy(input: DeployInput) {
    // Contracts are pre-deployed to Sepolia. Return the existing address.
    const contractAddress = process.env.KADRA_TOKEN_ADDRESS;
    if (!contractAddress) {
      throw new Error(
        'KADRA_TOKEN_ADDRESS env var required — deploy contracts via scripts/deploy-kadra-sepolia.js first',
      );
    }

    const txHash =
      process.env.KADRA_TOKEN_DEPLOY_TX_HASH ||
      '0x0000000000000000000000000000000000000000000000000000000000000000';

    // Get current block number for the record
    const blockNumber = await this.viem.publicClient.getBlockNumber();

    return {
      contractAddress,
      txHash,
      blockNumber: Number(blockNumber),
    };
  }

  async mint(input: MintInput) {
    const amount = parseUnits(input.amount, 18);
    const contractAddress = input.contractAddress as Address;
    const toAddress = input.toAddress as Address;

    const hash = await this.viem.deployerWalletClient.writeContract({
      address: contractAddress,
      abi: KADRA_TOKEN_ABI,
      functionName: 'mint',
      args: [toAddress, amount],
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

  async transfer(
    _input: TransferInput,
  ): Promise<{ txHash: string; blockNumber: number }> {
    // Transfers are now non-custodial: signed by the investor's wallet in the frontend.
    // Use verifyTransferTx() to confirm a frontend-submitted transaction.
    throw new Error(
      'Direct backend transfer is disabled. Transfers must be signed by the investor wallet in the frontend.',
    );
  }

  /**
   * Verify a transfer transaction that was submitted by the frontend.
   * Returns the receipt details if the tx is confirmed and valid.
   */
  async verifyTransferTx(txHash: string) {
    const receipt = await this.viem.publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: 60_000,
    });

    return {
      txHash: receipt.transactionHash,
      blockNumber: Number(receipt.blockNumber),
      status: receipt.status === 'success' ? 'CONFIRMED' : 'REVERTED',
    };
  }

  async getBalance(
    contractAddress: string,
    walletAddress: string,
  ): Promise<string> {
    const balance = await this.viem.publicClient.readContract({
      address: contractAddress as Address,
      abi: KADRA_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as Address],
    });

    return formatUnits(balance as bigint, 18);
  }
}
