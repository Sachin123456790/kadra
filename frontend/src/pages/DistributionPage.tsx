import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, DEFAULT_FUND_CODE } from '@/config/constants';
import { getWaterfallConfig } from '@/services/fund.service';
import { previewDistribution } from '@/services/distribution.service';
import type { DistributionLineItem } from '@/services/distribution.service';
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<DistributionLineItem>[] = [
  { key: "investorName", header: "Investor", render: (r) => r.investorName ?? "—" },
  { key: "ownershipPctUsed", header: "Ownership %", render: (r) => `${Number(r.ownershipPctUsed).toFixed(1)}%` },
  { key: "grossAmount", header: "Gross Allocation", render: (r) => fmt(parseFloat(r.grossAmount)) },
  { key: "netAmount", header: "Net Amount", render: (r) => fmt(parseFloat(r.netAmount)) },
];

export default function DistributionPage() {
  const fundId = DEFAULT_FUND_CODE;
  const [grossAmount, setGrossAmount] = useState('3000000');

  const {
    data: waterfallData,
    isLoading: waterfallLoading,
    error: waterfallError,
  } = useQuery({
    queryKey: QUERY_KEYS.waterfallConfig(fundId),
    queryFn: () => getWaterfallConfig(fundId).then(r => r.data),
  });

  const {
    data: previewData,
    isLoading: previewLoading,
    error: previewError,
  } = useQuery({
    queryKey: ['fund', fundId, 'distribution-preview', grossAmount],
    queryFn: () =>
      previewDistribution(fundId, {
        waterfallConfigId: waterfallData?.waterfallConfigId ?? '',
        asOfTimestamp: new Date().toISOString(),
        grossDistributableAmount: grossAmount,
        currency: 'USD',
      }).then(r => r.data),
    enabled: !!waterfallData?.waterfallConfigId && grossAmount.length > 0,
  });

  if (waterfallLoading) return <div className="p-6">Loading...</div>;
  if (waterfallError) return <ErrorAlert title="Waterfall Config Error" message={(waterfallError as Error).message} />;

  const dc = waterfallData;
  const catchUpLabel = dc?.catchUpEnabled
    ? `100% to GP until ${dc.prefReturnPct ?? 0}% preferred return met`
    : 'Disabled';
  const gpPromoteLabel = dc?.gpPromotePct
    ? `${dc.gpPromotePct}% above ${dc.prefReturnPct ?? 0}% hurdle`
    : '—';

  return (
    <div>
      <PageHeader title="Distribution" subtitle="Waterfall configuration and distribution preview" />
      <SectionCard title="Waterfall Configuration" className="mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ["Basis", dc?.calculationBasis ?? "—"],
            ["Frequency", dc?.distributionFrequency ?? "—"],
            ["Catch-up", catchUpLabel],
            ["GP Promote", gpPromoteLabel],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{k}</p>
              <p className="mt-1 text-sm text-gray-900">{v}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Distribution Parameters" className="mb-6">
        <div className="max-w-sm">
          <label htmlFor="grossAmount" className="block text-sm font-medium text-gray-900 mb-1">
            Gross Distributable Amount (USD)
          </label>
          <input
            id="grossAmount"
            type="text"
            inputMode="numeric"
            value={grossAmount}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              setGrossAmount(val);
            }}
            placeholder="e.g. 3000000"
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Total amount available for distribution across all investors.
          </p>
        </div>
      </SectionCard>
      <SectionCard title="Distribution Preview">
        {previewLoading ? (
          <div className="p-6">Loading preview...</div>
        ) : previewError ? (
          <ErrorAlert title="Preview Error" message={(previewError as Error).message} />
        ) : !previewData || previewData.lineItems.length === 0 ? (
          <EmptyState title="No distribution data" message="No settled ownership positions to distribute against." />
        ) : (
          <DataTable
            columns={columns}
            data={previewData.lineItems}
            getRowId={(r) => r.investorId ?? r.walletAddress}
          />
        )}
      </SectionCard>
    </div>
  );
}
