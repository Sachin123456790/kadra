export interface DeployInput {
  name: string;
  symbol: string;
  identityRegistryAddress: string;
}

export interface MintInput {
  contractAddress: string;
  toAddress: string;
  amount: string;
}

export interface TransferInput {
  contractAddress: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
}

export interface TokenContractAdapter {
  deploy(
    input: DeployInput,
  ): Promise<{ contractAddress: string; txHash: string; blockNumber: number }>;
  mint(input: MintInput): Promise<{ txHash: string; blockNumber: number }>;
  transfer(
    input: TransferInput,
  ): Promise<{ txHash: string; blockNumber: number }>;
  getBalance(contractAddress: string, walletAddress: string): Promise<string>;
}

export const TOKEN_CONTRACT_ADAPTER = 'TOKEN_CONTRACT_ADAPTER';
