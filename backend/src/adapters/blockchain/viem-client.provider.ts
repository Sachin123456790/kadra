import { Injectable } from '@nestjs/common';
import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

const PUBLIC_SEPOLIA_RPC_URLS = [
  'https://rpc.sepolia.org',
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
] as const;
const RPC_TIMEOUT_MS = 8_000;

@Injectable()
export class ViemClientProvider {
  private readonly chain: Chain;
  private readonly deployerAccount: PrivateKeyAccount;

  readonly publicClient: PublicClient<Transport, Chain>;
  readonly deployerWalletClient: WalletClient<
    Transport,
    Chain,
    PrivateKeyAccount
  >;

  constructor() {
    // Demo environment: use multiple public Sepolia RPCs so a single
    // slow endpoint does not block minting.
    this.chain = sepolia;

    const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!deployerKey) {
      throw new Error(
        'DEPLOYER_PRIVATE_KEY is required for blockchain operations',
      );
    }

    this.deployerAccount = privateKeyToAccount(deployerKey as `0x${string}`);

    const transport = fallback(
      PUBLIC_SEPOLIA_RPC_URLS.map((url) => http(url, { timeout: RPC_TIMEOUT_MS })),
    );

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport,
    }) as PublicClient<Transport, Chain>;

    this.deployerWalletClient = createWalletClient({
      account: this.deployerAccount,
      chain: this.chain,
      transport,
    }) as WalletClient<Transport, Chain, PrivateKeyAccount>;
  }

  get deployerAddress(): string {
    return this.deployerAccount.address;
  }
}
