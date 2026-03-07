import { Injectable } from '@nestjs/common';
import {
  TokenContractAdapter,
  DeployInput,
  MintInput,
  TransferInput,
} from './token-contract.adapter';
import { createHash, randomUUID } from 'crypto';

@Injectable()
export class MockTokenContractAdapter implements TokenContractAdapter {
  private balances = new Map<string, Map<string, bigint>>();
  private blockNumber = 100;

  private genTxHash(): string {
    return (
      '0x' + createHash('sha256').update(randomUUID()).digest('hex')
    );
  }

  async deploy(input: DeployInput) {
    const contractAddress =
      '0x' +
      createHash('sha256')
        .update(input.name + Date.now())
        .digest('hex')
        .slice(0, 40);
    this.balances.set(contractAddress.toLowerCase(), new Map());
    return {
      contractAddress,
      txHash: this.genTxHash(),
      blockNumber: ++this.blockNumber,
    };
  }

  async mint(input: MintInput) {
    const contract = input.contractAddress.toLowerCase();
    const wallet = input.toAddress.toLowerCase();
    if (!this.balances.has(contract))
      this.balances.set(contract, new Map());
    const balMap = this.balances.get(contract)!;
    const current = balMap.get(wallet) ?? 0n;
    const amount = BigInt(Math.round(parseFloat(input.amount) * 1e18));
    balMap.set(wallet, current + amount);
    return { txHash: this.genTxHash(), blockNumber: ++this.blockNumber };
  }

  async transfer(input: TransferInput) {
    const contract = input.contractAddress.toLowerCase();
    const from = input.fromAddress.toLowerCase();
    const to = input.toAddress.toLowerCase();
    const balMap = this.balances.get(contract) ?? new Map();
    const amount = BigInt(Math.round(parseFloat(input.amount) * 1e18));
    const fromBal = balMap.get(from) ?? 0n;
    if (fromBal < amount) throw new Error('Insufficient balance');
    balMap.set(from, fromBal - amount);
    balMap.set(to, (balMap.get(to) ?? 0n) + amount);
    return { txHash: this.genTxHash(), blockNumber: ++this.blockNumber };
  }

  async getBalance(
    contractAddress: string,
    walletAddress: string,
  ): Promise<string> {
    const balMap = this.balances.get(contractAddress.toLowerCase());
    const bal = balMap?.get(walletAddress.toLowerCase()) ?? 0n;
    return (Number(bal) / 1e18).toString();
  }
}
