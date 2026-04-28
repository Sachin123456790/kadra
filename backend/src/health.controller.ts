import { Controller, Get } from '@nestjs/common';
import { Public } from './common/auth/public.decorator';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('version')
  version() {
    return { version: '0.1.0', name: 'angainor-api' };
  }

  @Public()
  @Get('config')
  config() {
    const chainId = Number(process.env.CHAIN_ID ?? 11155111);
    const explorerBaseUrl =
      process.env.EXPLORER_BASE_URL ??
      (chainId === 1
        ? 'https://etherscan.io'
        : chainId === 11155111
          ? 'https://sepolia.etherscan.io'
          : 'https://sepolia.etherscan.io');

    return {
      data: {
        chainId,
        explorerBaseUrl,
        contracts: {
          identityRegistry: process.env.IDENTITY_REGISTRY_ADDRESS ?? null,
          documentRegistry: process.env.DOCUMENT_REGISTRY_ADDRESS ?? null,
          angainorToken: process.env.ANGAINOR_TOKEN_ADDRESS ?? null,
          fundTermsRegistry: process.env.FUND_TERMS_REGISTRY_ADDRESS ?? null,
        },
        defaults: {
          fundCode: process.env.DEFAULT_FUND_CODE ?? 'ANGAINOR-DEMO-001',
          fundName: process.env.DEFAULT_FUND_NAME ?? 'Angainor Demo Fund I',
          tokenSymbol: process.env.TOKEN_SYMBOL ?? 'KDRA',
          tokenDecimals: Number(process.env.TOKEN_DECIMALS ?? 18),
          targetSize: Number(process.env.DEFAULT_FUND_TARGET_SIZE ?? 5_000_000),
          totalSupply: Number(process.env.DEFAULT_TOTAL_SUPPLY ?? 10_000),
        },
      },
      meta: {
        requestId: `cfg-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
