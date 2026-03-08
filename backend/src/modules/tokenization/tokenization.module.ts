import { Module } from '@nestjs/common';
import { TokenizationController } from './tokenization.controller';
import { TokenizationService } from './tokenization.service';
import { TOKEN_CONTRACT_ADAPTER } from '../../adapters/blockchain/token-contract.adapter';
import { MockTokenContractAdapter } from '../../adapters/blockchain/mock-token-contract.adapter';
import { SepoliaTokenContractAdapter } from '../../adapters/blockchain/sepolia-token-contract.adapter';

function isRemoteChain(): boolean {
  const rpcUrl = process.env.CHAIN_RPC_URL;
  if (!rpcUrl) return false;
  if (rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1'))
    return false;
  return true;
}

@Module({
  controllers: [TokenizationController],
  providers: [
    TokenizationService,
    {
      provide: TOKEN_CONTRACT_ADAPTER,
      useClass: isRemoteChain()
        ? SepoliaTokenContractAdapter
        : MockTokenContractAdapter,
    },
  ],
  exports: [TokenizationService, TOKEN_CONTRACT_ADAPTER],
})
export class TokenizationModule {}
