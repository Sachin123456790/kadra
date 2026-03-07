import { Module } from '@nestjs/common';
import { TokenizationController } from './tokenization.controller';
import { TokenizationService } from './tokenization.service';
import { TOKEN_CONTRACT_ADAPTER } from '../../adapters/blockchain/token-contract.adapter';
import { MockTokenContractAdapter } from '../../adapters/blockchain/mock-token-contract.adapter';

@Module({
  controllers: [TokenizationController],
  providers: [
    TokenizationService,
    { provide: TOKEN_CONTRACT_ADAPTER, useClass: MockTokenContractAdapter },
  ],
  exports: [TokenizationService, TOKEN_CONTRACT_ADAPTER],
})
export class TokenizationModule {}
