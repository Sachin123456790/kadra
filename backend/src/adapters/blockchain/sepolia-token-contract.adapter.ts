import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import {
  TokenContractAdapter,
  DeployInput,
  MintInput,
  TransferInput,
} from './token-contract.adapter';

@Injectable()
export class SepoliaTokenContractAdapter implements TokenContractAdapter {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly signer: ethers.Wallet | null;

  constructor() {
    const rpcUrl = process.env.CHAIN_RPC_URL || 'https://rpc.sepolia.org';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    this.signer = privateKey
      ? new ethers.Wallet(privateKey, this.provider)
      : null;
  }

  async deploy(input: DeployInput) {
    const block = await this.provider.getBlockNumber();
    // For the demo, derive a deterministic address from the deployment input.
    // In production, this would deploy the actual KadraToken contract via ABI.
    const contractAddress = ethers.getAddress(
      '0x' +
        ethers
          .keccak256(
            ethers.toUtf8Bytes(input.name + Date.now().toString()),
          )
          .slice(2, 42),
    );
    const txHash = ethers.keccak256(
      ethers.toUtf8Bytes('deploy-' + contractAddress + block),
    );

    return {
      contractAddress,
      txHash,
      blockNumber: block,
    };
  }

  async mint(input: MintInput) {
    const block = await this.provider.getBlockNumber();
    const txHash = ethers.keccak256(
      ethers.toUtf8Bytes(
        'mint-' + input.toAddress + '-' + input.amount + '-' + block,
      ),
    );
    return { txHash, blockNumber: block };
  }

  async transfer(input: TransferInput) {
    const block = await this.provider.getBlockNumber();
    const txHash = ethers.keccak256(
      ethers.toUtf8Bytes(
        'transfer-' +
          input.fromAddress +
          '-' +
          input.toAddress +
          '-' +
          input.amount +
          '-' +
          block,
      ),
    );
    return { txHash, blockNumber: block };
  }

  async getBalance(
    _contractAddress: string,
    _walletAddress: string,
  ): Promise<string> {
    // In production, this would call the ERC-20 balanceOf method on-chain
    return '0';
  }
}
