import { useQuery } from '@tanstack/react-query';
import { getFundOverview, getWaterfallConfig, type FundOverview, type WaterfallConfig } from '@/services/fund.service';
import { DEFAULT_FUND_CODE, QUERY_KEYS } from '@/config/constants';
import { useAppConfig } from './useAppConfig';

export interface CurrentFund {
  fundId: string;
  fund: FundOverview | null;
  waterfallConfig: WaterfallConfig | null;
  targetSize: number;
  isLoading: boolean;
  error: unknown;
}

export function useCurrentFund(): CurrentFund {
  const { data: config } = useAppConfig();
  const fundId = config?.defaults.fundCode ?? DEFAULT_FUND_CODE;

  const { data: fund, isLoading: fundLoading, error: fundErr } = useQuery({
    queryKey: QUERY_KEYS.fundOverview(fundId),
    queryFn: async () => (await getFundOverview(fundId)).data,
    staleTime: 60_000,
  });

  const { data: waterfallConfig, isLoading: wfLoading } = useQuery({
    queryKey: QUERY_KEYS.waterfallConfig(fundId),
    queryFn: async () => (await getWaterfallConfig(fundId)).data,
    staleTime: 60_000,
    retry: 0,
  });

  return {
    fundId,
    fund: fund ?? null,
    waterfallConfig: waterfallConfig ?? null,
    targetSize: config?.defaults.targetSize ?? 5_000_000,
    isLoading: fundLoading || wfLoading,
    error: fundErr,
  };
}
