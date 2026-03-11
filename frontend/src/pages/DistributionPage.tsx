import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { AlertTriangle, Lock, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { QUERY_KEYS, DEFAULT_FUND_CODE } from '@/config/constants';
import { getWaterfallConfig } from '@/services/fund.service';
import { previewDistribution } from '@/services/distribution.service';
import { getCapitalAccounts } from '@/services/ownership.service';
import { getDocuments } from '@/services/documents.service';
import type { DistributionLineItem } from '@/services/distribution.service';
import type { CapitalAccountSummary } from '@/services/ownership.service';
import type { WaterfallConfig } from '@/services/fund.service';
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { MetricCard } from "@/components/kadra/MetricCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

/* ── Copy Button ── */

function CopyButton({ text }: { readonly text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="ml-1 inline-flex text-gray-400 hover:text-gray-600 transition-colors"
      title="Copy to clipboard"
      type="button"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ── Truncated Hash ── */

function TruncatedHash({ hash }: { readonly hash: string | null | undefined }) {
  if (!hash || hash === "—") return <span className="text-gray-500">—</span>;
  const truncated = hash.length > 12 ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : hash;
  return (
    <span className="inline-flex items-center">
      <span className="font-mono text-xs text-gray-600">{truncated}</span>
      <CopyButton text={hash} />
    </span>
  );
}

/* ── Waterfall Tier Card ── */

interface TierInfo {
  readonly name: string;
  readonly description: string;
  readonly lpShare: number;
  readonly gpShare: number;
}

function buildTierDisplay(config: WaterfallConfig): TierInfo[] {
  if (config.rules?.tiers && config.rules.tiers.length > 0) {
    return config.rules.tiers.map((tier) => ({
      name: tier.name,
      description: tier.hurdle ?? "",
      lpShare: tier.lpShare,
      gpShare: tier.gpShare,
    }));
  }

  // Fallback default tiers
  return [
    { name: "Return of Capital", description: "100% to LPs", lpShare: 100, gpShare: 0 },
    { name: "Preferred Return", description: `${config.prefReturnPct ?? 8}% simple annual, 100% to LPs`, lpShare: 100, gpShare: 0 },
    { name: "GP Catch-up", description: "100% to GP", lpShare: 0, gpShare: 100 },
    { name: "Carried Interest", description: `${100 - (config.gpPromotePct ?? 20)}% LPs / ${config.gpPromotePct ?? 20}% GP`, lpShare: 100 - (config.gpPromotePct ?? 20), gpShare: config.gpPromotePct ?? 20 },
  ];
}

function WaterfallConfigSection({ config, lpaHash }: { readonly config: WaterfallConfig; readonly lpaHash: string | null }) {
  const tiers = buildTierDisplay(config);

  return (
    <SectionCard title="Waterfall Configuration" className="mb-6">
      <div className="space-y-4">
        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {tiers.map((tier, idx) => (
            <div
              key={tier.name}
              className="rounded-md border border-gray-200 bg-white p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Tier {idx + 1}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{tier.name}</p>
              <p className="mt-1 text-xs text-gray-600">
                {tier.description || `${tier.lpShare}% LPs / ${tier.gpShare}% GP`}
              </p>
            </div>
          ))}
        </div>

        {/* Metadata row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Calculation Basis</p>
            <p className="mt-1 text-sm text-gray-900">{config.calculationBasis ?? "IRR"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Waterfall Version</p>
            <p className="mt-1 text-sm text-gray-900">{config.version ?? "1.0"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Distribution Frequency</p>
            <p className="mt-1 text-sm text-gray-900">{config.distributionFrequency ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Status</p>
            <p className="mt-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                <Lock className="h-3 w-3" />
                Locked
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Derived From (LPA Hash)</p>
            <p className="mt-1">
              <TruncatedHash hash={lpaHash} />
            </p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

/* ── Distribution Bar Chart ── */

function DistributionBarChart({ lineItems }: { readonly lineItems: ReadonlyArray<DistributionLineItem> }) {
  const chartData = useMemo(
    () =>
      lineItems.map((item) => ({
        name: item.investorName ?? 'Unknown',
        gross: parseFloat(item.grossAmount),
        net: parseFloat(item.netAmount),
      })),
    [lineItems],
  );

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-3">Allocation per Investor</h4>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 8, right: 24, left: 16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
          <YAxis
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <Tooltip
            formatter={(value: number) => fmt(value)}
            contentStyle={{ borderRadius: 6, borderColor: '#e5e7eb', fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="gross" name="Gross Allocation" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
          <Bar dataKey="net" name="Net Amount" fill="#4338ca" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Per-LP Breakdown Columns ── */

function getTierValue(item: DistributionLineItem, ...keys: string[]): number {
  const tb = item.tierBreakdown as Record<string, string | number> | null;
  if (!tb) return 0;
  for (const key of keys) {
    if (tb[key] !== undefined) return parseFloat(String(tb[key]));
  }
  return 0;
}

const breakdownColumns: Column<DistributionLineItem>[] = [
  {
    key: "investorName",
    header: "Investor",
    render: (r) => <span className="font-medium text-gray-900">{r.investorName ?? "—"}</span>,
  },
  {
    key: "ownershipPctUsed",
    header: "Ownership %",
    render: (r) => <span className="text-gray-900">{Number(r.ownershipPctUsed).toFixed(2)}%</span>,
  },
  {
    key: "grossAmount",
    header: "Gross Allocation",
    render: (r) => <span className="text-gray-900">{fmt(parseFloat(r.grossAmount))}</span>,
  },
  {
    key: "capitalReturned",
    header: "Capital Returned",
    render: (r) => <span className="text-gray-900">{fmt(getTierValue(r, 'returnOfCapital', 'Return of Capital'))}</span>,
  },
  {
    key: "preferredReturn",
    header: "Preferred Return",
    render: (r) => <span className="text-gray-900">{fmt(getTierValue(r, 'preferredReturn', 'Preferred Return'))}</span>,
  },
  {
    key: "residualShare",
    header: "Residual Share",
    render: (r) => <span className="text-gray-900">{fmt(getTierValue(r, 'residualLp', 'Residual LP'))}</span>,
  },
  {
    key: "netAmount",
    header: "Net Distribution",
    render: (r) => <span className="font-semibold text-gray-900">{fmt(parseFloat(r.netAmount))}</span>,
  },
];

/* ── Simulation Section ── */

function SimulationSection({
  waterfallConfigId,
  fundId,
}: {
  readonly waterfallConfigId: string;
  readonly fundId: string;
}) {
  const [exitProceeds, setExitProceeds] = useState('3000000');
  const [holdPeriodYears, setHoldPeriodYears] = useState('5');
  const [shouldRun, setShouldRun] = useState(false);

  const {
    data: previewData,
    isLoading: previewLoading,
    error: previewError,
  } = useQuery({
    queryKey: ['fund', fundId, 'distribution-preview', exitProceeds, holdPeriodYears],
    queryFn: () =>
      previewDistribution(fundId, {
        waterfallConfigId,
        asOfTimestamp: new Date().toISOString(),
        grossDistributableAmount: exitProceeds,
        currency: 'USD',
      }).then(r => r.data),
    enabled: shouldRun && exitProceeds.length > 0,
  });

  const handleRunSimulation = useCallback(() => {
    setShouldRun(true);
  }, []);

  const totalGross = previewData?.lineItems.reduce((s, i) => s + parseFloat(i.grossAmount), 0) ?? 0;
  const totalNet = previewData?.lineItems.reduce((s, i) => s + parseFloat(i.netAmount), 0) ?? 0;

  const tierTotals = useMemo(() => {
    if (!previewData?.lineItems) return null;
    let returnOfCapital = 0;
    let preferredReturn = 0;
    let residualLp = 0;
    let gpPromote = 0;

    for (const item of previewData.lineItems) {
      const tb = item.tierBreakdown as Record<string, string | number> | null;
      if (!tb) continue;
      returnOfCapital += parseFloat(String(tb.returnOfCapital ?? tb['Return of Capital'] ?? 0));
      preferredReturn += parseFloat(String(tb.preferredReturn ?? tb['Preferred Return'] ?? 0));
      residualLp += parseFloat(String(tb.residualLp ?? tb['Residual LP'] ?? 0));
      gpPromote += parseFloat(String(tb.gpPromote ?? tb['GP Promote'] ?? tb['Carried Interest'] ?? 0));
    }

    return { returnOfCapital, preferredReturn, residualLp, gpPromote };
  }, [previewData]);

  return (
    <SectionCard title="Simulate Distribution" className="mb-6">
      {/* Warning banner */}
      <div className="mb-6 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          Simulation Mode — No funds will be moved. This is a preview only.
        </p>
      </div>

      {/* Input fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="exitProceeds" className="block text-sm font-medium text-gray-900 mb-1">
            Total Exit Proceeds ($)
          </label>
          <input
            id="exitProceeds"
            type="text"
            inputMode="numeric"
            value={exitProceeds}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              setExitProceeds(val);
              setShouldRun(false);
            }}
            placeholder="e.g. 3000000"
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="holdPeriod" className="block text-sm font-medium text-gray-900 mb-1">
            Hold Period (years)
          </label>
          <input
            id="holdPeriod"
            type="text"
            inputMode="numeric"
            value={holdPeriodYears}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              setHoldPeriodYears(val);
              setShouldRun(false);
            }}
            placeholder="e.g. 5"
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <button
        onClick={handleRunSimulation}
        disabled={!exitProceeds || previewLoading}
        className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
        type="button"
      >
        {previewLoading ? "Running..." : "Run Simulation"}
      </button>

      {/* Results */}
      {previewError && (
        <div className="mt-6">
          <ErrorAlert title="Simulation Error" message={(previewError as Error).message} />
        </div>
      )}

      {previewData && previewData.lineItems.length > 0 && (
        <div className="mt-6 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total Gross" value={fmt(totalGross)} />
            <MetricCard label="Total Net to LPs" value={fmt(totalNet)} />
            <MetricCard label="GP Promote" value={fmt(totalGross - totalNet)} />
            <MetricCard label="Investors" value={previewData.lineItems.length} />
          </div>

          {/* Tier-by-tier breakdown */}
          {tierTotals && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Return of Capital" value={fmt(tierTotals.returnOfCapital)} />
              <MetricCard label="Preferred Return" value={fmt(tierTotals.preferredReturn)} />
              <MetricCard label="Residual LP" value={fmt(tierTotals.residualLp)} />
              <MetricCard label="GP Promote" value={fmt(tierTotals.gpPromote)} />
            </div>
          )}

          {/* Chart */}
          <DistributionBarChart lineItems={previewData.lineItems} />

          {/* Per-LP breakdown table */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Per-LP Breakdown</h4>
            <DataTable
              columns={breakdownColumns}
              data={previewData.lineItems}
              getRowId={(r) => r.investorId ?? r.walletAddress}
            />
          </div>
        </div>
      )}

      {previewData && previewData.lineItems.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No distribution data"
            message="No settled ownership positions to distribute against."
          />
        </div>
      )}
    </SectionCard>
  );
}

/* ── Capital Accounts Section ── */

const capitalAccountColumns: Column<CapitalAccountSummary>[] = [
  {
    key: "investorName",
    header: "LP Name",
    render: (r) => (
      <span className="font-medium text-gray-900">
        {r.investor?.legalName ?? "—"}
      </span>
    ),
  },
  {
    key: "initialContribution",
    header: "Capital Contributed",
    render: (r) => <span className="text-gray-900">{fmt(parseFloat(r.initialContribution))}</span>,
  },
  {
    key: "capitalReturned",
    header: "Capital Returned",
    render: (r) => <span className="text-gray-900">{fmt(parseFloat(r.capitalReturned))}</span>,
  },
  {
    key: "accruedPreferredReturn",
    header: "Pref Return Accrued",
    render: (r) => <span className="text-gray-900">{fmt(parseFloat(r.accruedPreferredReturn))}</span>,
  },
  {
    key: "distributionsReceived",
    header: "Distributions Received",
    render: (r) => {
      const val = (r as CapitalAccountSummary & { distributionsReceived?: string }).distributionsReceived;
      return <span className="text-gray-900">{fmt(val ? parseFloat(val) : 0)}</span>;
    },
  },
  {
    key: "endingBalance",
    header: "Ending Balance",
    render: (r) => (
      <span className="font-semibold text-gray-900">{fmt(parseFloat(r.endingBalance))}</span>
    ),
  },
  {
    key: "asOfDate",
    header: "As Of",
    render: (r) => (
      <span className="text-gray-600">
        {r.asOfDate
          ? new Date(r.asOfDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "—"}
      </span>
    ),
  },
];

function CapitalAccountDetail({ account }: { readonly account: CapitalAccountSummary }) {
  return (
    <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
      <h5 className="text-sm font-semibold text-gray-900 mb-3">
        Capital Account Statement — {account.investor?.legalName ?? "Unknown"}
      </h5>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Opening Balance</p>
          <p className="mt-1 text-sm text-gray-900">{fmt(parseFloat(account.openingBalance))}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Initial Contribution</p>
          <p className="mt-1 text-sm text-gray-900">{fmt(parseFloat(account.initialContribution))}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Capital Returned</p>
          <p className="mt-1 text-sm text-gray-900">{fmt(parseFloat(account.capitalReturned))}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Preferred Return Accrued</p>
          <p className="mt-1 text-sm text-gray-900">{fmt(parseFloat(account.accruedPreferredReturn))}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Ending Balance</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{fmt(parseFloat(account.endingBalance))}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">As Of Date</p>
          <p className="mt-1 text-sm text-gray-900">
            {account.asOfDate
              ? new Date(account.asOfDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function CapitalAccountsSection({ fundId }: { readonly fundId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data: accounts,
    isLoading,
    error,
  } = useQuery({
    queryKey: QUERY_KEYS.capitalAccounts(fundId),
    queryFn: () => getCapitalAccounts(fundId).then(r => r.data),
    refetchInterval: 30000,
  });

  const handleRowClick = useCallback((row: CapitalAccountSummary) => {
    setExpandedId((prev) => (prev === row.id ? null : row.id));
  }, []);

  const columnsWithExpand: Column<CapitalAccountSummary>[] = useMemo(
    () => [
      ...capitalAccountColumns,
      {
        key: "_expand",
        header: "",
        render: (r: CapitalAccountSummary) => (
          <span className="text-gray-400">
            {expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        ),
        className: "w-10",
      },
    ],
    [expandedId],
  );

  return (
    <SectionCard title="Capital Accounts">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <ErrorAlert title="Capital Accounts Error" message={(error as Error).message} />
      ) : !accounts || accounts.length === 0 ? (
        <EmptyState
          title="No capital accounts"
          message="Capital accounts will appear here after settlement is complete."
        />
      ) : (
        <div>
          <DataTable
            columns={columnsWithExpand}
            data={accounts}
            onRowClick={handleRowClick}
            selectedId={expandedId ?? undefined}
            getRowId={(r) => r.id}
          />
          {expandedId && accounts.find((a) => a.id === expandedId) && (
            <CapitalAccountDetail
              account={accounts.find((a) => a.id === expandedId)!}
            />
          )}
        </div>
      )}
    </SectionCard>
  );
}

/* ── Page ── */

export default function DistributionPage() {
  const fundId = DEFAULT_FUND_CODE;

  const {
    data: waterfallData,
    isLoading: waterfallLoading,
    error: waterfallError,
  } = useQuery({
    queryKey: QUERY_KEYS.waterfallConfig(fundId),
    queryFn: () => getWaterfallConfig(fundId).then(r => r.data),
  });

  const { data: documents } = useQuery({
    queryKey: QUERY_KEYS.documents(fundId),
    queryFn: () => getDocuments(fundId).then(r => r.data),
  });

  const lpaHash = useMemo(() => {
    if (!documents) return null;
    const lpa = documents.find((d) => d.documentType === 'MASTER_LPA');
    return lpa?.hash?.hashHex ?? null;
  }, [documents]);

  if (waterfallLoading) return <div className="p-6">Loading...</div>;
  if (waterfallError) return <ErrorAlert title="Waterfall Config Error" message={(waterfallError as Error).message} />;

  return (
    <div>
      <PageHeader title="Distribution" subtitle="Waterfall configuration, simulation, and capital accounts" />

      {/* Section 1: Waterfall Configuration */}
      {waterfallData && <WaterfallConfigSection config={waterfallData} lpaHash={lpaHash} />}

      {/* Section 2: Distribution Simulation */}
      {waterfallData?.waterfallConfigId && (
        <SimulationSection
          waterfallConfigId={waterfallData.waterfallConfigId}
          fundId={fundId}
        />
      )}

      {/* Section 3: Capital Accounts */}
      <CapitalAccountsSection fundId={fundId} />
    </div>
  );
}
