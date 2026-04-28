import { useQuery } from '@tanstack/react-query';
import { get } from '@/services/api-client';

export interface AppConfig {
  chainId: number;
  explorerBaseUrl: string;
  contracts: {
    identityRegistry: string | null;
    documentRegistry: string | null;
    angainorToken: string | null;
    fundTermsRegistry: string | null;
  };
  defaults: {
    fundCode: string;
    fundName: string;
    tokenSymbol: string;
    tokenDecimals: number;
    targetSize: number;
    totalSupply: number;
  };
}

async function fetchAppConfig(): Promise<AppConfig> {
  const res = await get<AppConfig>('/config');
  return res.data;
}

export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: fetchAppConfig,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
