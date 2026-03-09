import { Module } from '@nestjs/common';
import { TokenizationController } from './tokenization.controller';
import { TokenizationService } from './tokenization.service';
import { TOKEN_CONTRACT_ADAPTER } from '../../adapters/blockchain/token-contract.adapter';
import { ViemTokenContractAdapter } from '../../adapters/blockchain/viem-token-contract.adapter';
import { ViemClientProvider } from '../../adapters/blockchain/viem-client.provider';

@Module({
  controllers: [TokenizationController],
  providers: [
    TokenizationService,
    ViemClientProvider,
    {
      provide: TOKEN_CONTRACT_ADAPTER,
      useClass: ViemTokenContractAdapter,
    },
  ],
  exports: [TokenizationService, TOKEN_CONTRACT_ADAPTER, ViemClientProvider],
})
export class TokenizationModule {}
