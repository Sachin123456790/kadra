import { Injectable } from '@nestjs/common';
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

@Injectable()
export class ViemClientProvider {
  private readonly rpcUrl: string;
  private readonly chain: Chain;
  private readonly deployerAccount: PrivateKeyAccount;

  readonly publicClient: PublicClient<Transport, Chain>;
  readonly deployerWalletClient: WalletClient<
    Transport,
    Chain,
    PrivateKeyAccount
  >;

  constructor() {
    this.rpcUrl = process.env.CHAIN_RPC_URL || 'https://rpc.sepolia.org';
    this.chain = sepolia;

    const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!deployerKey) {
      throw new Error(
        'DEPLOYER_PRIVATE_KEY is required for blockchain operations',
      );
    }

    this.deployerAccount = privateKeyToAccount(deployerKey as `0x${string}`);

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.rpcUrl),
    }) as PublicClient<Transport, Chain>;

    this.deployerWalletClient = createWalletClient({
      account: this.deployerAccount,
      chain: this.chain,
      transport: http(this.rpcUrl),
    }) as WalletClient<Transport, Chain, PrivateKeyAccount>;
  }

  get deployerAddress(): string {
    return this.deployerAccount.address;
  }
}
