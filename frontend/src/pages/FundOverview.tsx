import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/kadra/PageHeader";
import { MetricCard } from "@/components/kadra/MetricCard";
import { SectionCard } from "@/components/kadra/SectionCard";
import { KadraTabs } from "@/components/kadra/KadraTabs";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getFundOverview } from "@/services";
import { getInvestors } from "@/services/investors.service";
import { getCapTable } from "@/services/ownership.service";
import { ExplorerLink } from "@/components/kadra/ExplorerLink";

const CAPITAL_COLORS = ["#4338ca", "#a5b4fc", "#d1d5db"] as const;
const BAR_COLOR = "#4f46e5";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtCompact = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
const pct = (n: number) => `${n.toFixed(1)}%`;

/* ── Capital Breakdown Donut ── */

interface CapitalDonutProps {
  readonly settledCapital: number;
  readonly pendingCapital: number;
  readonly committedCapital: number;
}

function CapitalDonutChart({ settledCapital, pendingCapital, committedCapital }: CapitalDonutProps) {
  const chartData = useMemo(() => [
    { name: "Settled", value: settledCapital },
    { name: "Pending", value: pendingCapital },
    ...(committedCapital - settledCapital - pendingCapital > 0
      ? [{ name: "Remaining", value: committedCapital - settledCapital - pendingCapital }]
      : []),
  ], [settledCapital, pendingCapital, committedCapital]);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
          >
            {chartData.map((entry, idx) => (
              <Cell key={entry.name} fill={CAPITAL_COLORS[idx] ?? CAPITAL_COLORS[2]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => fmt(value)}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => <span className="text-sm text-gray-600">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginBottom: 28 }}>
        <div className="text-center">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-sm font-semibold text-gray-900">{fmtCompact(committedCapital)}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Ownership Bar Chart ── */

interface OwnershipBarProps {
  readonly rows: ReadonlyArray<{ investorName: string | null; ownershipPct: number; investorId: string | null }>;
}

function OwnershipBarChart({ rows }: OwnershipBarProps) {
  const sortedData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.ownershipPct - a.ownershipPct)
        .map((r) => ({ name: r.investorName ?? "Unknown", ownership: Number(r.ownershipPct.toFixed(1)) })),
    [rows],
  );

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={sortedData} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
        <XAxis type="number" domain={[0, "dataMax"]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 12, fill: "#6b7280" }} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "#374151" }} />
        <Tooltip
          formatter={(value: number) => [`${value}%`, "Ownership"]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
        />
        <Bar dataKey="ownership" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function FundOverviewPage() {
  const [tab, setTab] = useState("Overview");
  const fundId = DEFAULT_FUND_CODE;

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.fundOverview(fundId),
    queryFn: () => getFundOverview(fundId).then(r => r.data),
  });

  const { data: investors } = useQuery({
    queryKey: QUERY_KEYS.investors(fundId),
    queryFn: () => getInvestors(fundId).then(r => r.data),
    enabled: tab === "Investors",
  });

  const { data: capTable } = useQuery({
    queryKey: QUERY_KEYS.capTable(fundId),
    queryFn: () => getCapTable(fundId).then(r => r.data),
    enabled: tab === "Performance" || tab === "Investors",
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load fund overview" message={(error as Error).message} />;
  if (!data) return <EmptyState title="No fund data" message="Fund overview is not available yet." />;

  const committedCapital = Number(data.totalCommittedAmount) || 0;
  const settledCapital = Number(data.totalSettledAmount) || 0;
  const settlementRate = committedCapital > 0 ? (settledCapital / committedCapital) * 100 : 0;
  const pendingCapital = committedCapital - settledCapital;

  return (
    <div>
      <PageHeader title={data.fundName} subtitle="Fund Overview" />
      <KadraTabs tabs={["Overview", "Performance", "Investors", "Sustainability"]} active={tab} onChange={setTab} />

      {/* ── Overview Tab ── */}
      {tab === "Overview" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Committed Capital" value={fmt(committedCapital)} />
            <MetricCard label="Settled Capital" value={fmt(settledCapital)} />
            <MetricCard label="Active LPs" value={data.lpCount} />
            <MetricCard label="Pending Subscriptions" value={data.pendingSubscriptions} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            {[
              { label: "Status", value: data.status },
              { label: "Eligible Wallets", value: String(data.eligibleWalletCount) },
              { label: "Settled Subscriptions", value: String(data.settledSubscriptions) },
              { label: "Token Symbol", value: data.tokenContract?.deploymentStatus === "DEPLOYED" ? "KDRA" : "Not deployed" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-card-foreground">{item.value}</p>
              </div>
            ))}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contract</p>
              <div className="mt-1 text-sm font-semibold text-card-foreground">
                {data.tokenContract?.contractAddress
                  ? <ExplorerLink value={data.tokenContract.contractAddress} type="address" />
                  : "N/A"}
              </div>
            </div>
          </div>

          {/* Key Dates */}
          {(data.createdAt || data.tokenContract?.deployedAt) && (
            <SectionCard title="Key Dates">
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.createdAt && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Fund Created</dt>
                    <dd className="mt-1 text-sm font-medium text-gray-900">
                      {new Date(data.createdAt).toLocaleDateString()} {new Date(data.createdAt).toLocaleTimeString()}
                    </dd>
                  </div>
                )}
                {data.tokenContract?.deployedAt && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Token Deployed</dt>
                    <dd className="mt-1 text-sm font-medium text-gray-900">
                      {new Date(data.tokenContract.deployedAt).toLocaleDateString()} {new Date(data.tokenContract.deployedAt).toLocaleTimeString()}
                    </dd>
                  </div>
                )}
              </dl>
            </SectionCard>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Fund Metrics">
              <dl className="space-y-3">
                {[
                  ["Total LPs", String(data.lpCount)],
                  ["Eligible Wallets", String(data.eligibleWalletCount)],
                  ["Pending Subscriptions", String(data.pendingSubscriptions)],
                  ["Settled Subscriptions", String(data.settledSubscriptions)],
                  ["Committed Capital", fmt(committedCapital)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                    <dt className="text-sm text-muted-foreground">{k}</dt>
                    <dd className="text-sm font-medium text-card-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>

            <SectionCard title="Token Contract">
              <dl className="space-y-3">
                {[
                  ["Deployment Status", data.tokenContract?.deploymentStatus ?? "Not deployed"],
                  ["Chain ID", data.tokenContract?.chainId ? String(data.tokenContract.chainId) : "N/A"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                    <dt className="text-sm text-muted-foreground">{k}</dt>
                    <dd className="text-sm font-medium text-card-foreground font-mono text-xs">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-b border-border pb-2 last:border-0">
                  <dt className="text-sm text-muted-foreground">Contract Address</dt>
                  <dd className="text-sm font-medium text-card-foreground">
                    {data.tokenContract?.contractAddress
                      ? <ExplorerLink value={data.tokenContract.contractAddress} type="address" truncate={false} />
                      : "N/A"}
                  </dd>
                </div>
              </dl>
            </SectionCard>
          </div>
        </>
      )}

      {/* ── Performance Tab ── */}
      {tab === "Performance" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Committed Capital" value={fmt(committedCapital)} />
            <MetricCard label="Settled Capital" value={fmt(settledCapital)} />
            <MetricCard label="Pending Capital" value={fmt(pendingCapital)} />
            <MetricCard label="Settlement Rate" value={pct(settlementRate)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <SectionCard title="Capital Breakdown">
              <div className="space-y-4">
                {/* Donut chart */}
                <CapitalDonutChart
                  settledCapital={settledCapital}
                  pendingCapital={pendingCapital}
                  committedCapital={committedCapital}
                />

                <div className="border-t border-border pt-4">
                  <dl className="space-y-3">
                    {[
                      ["Total Committed", fmt(committedCapital)],
                      ["Total Settled", fmt(settledCapital)],
                      ["Pending Settlement", fmt(pendingCapital)],
                      ["Settlement Rate", pct(settlementRate)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">{k}</dt>
                        <dd className="text-sm font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Subscription Metrics">
              <div className="space-y-4">
                {/* Subscription progress */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Subscription Completion</span>
                    <span className="font-medium">
                      {data.settledSubscriptions}/{data.settledSubscriptions + data.pendingSubscriptions}
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${(data.settledSubscriptions + data.pendingSubscriptions) > 0
                          ? (data.settledSubscriptions / (data.settledSubscriptions + data.pendingSubscriptions)) * 100
                          : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <dl className="space-y-3">
                    {[
                      ["Total Subscriptions", String(data.settledSubscriptions + data.pendingSubscriptions)],
                      ["Settled", String(data.settledSubscriptions)],
                      ["Pending", String(data.pendingSubscriptions)],
                      ["Active LPs", String(data.lpCount)],
                      ["Eligible Wallets", String(data.eligibleWalletCount)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-sm text-muted-foreground">{k}</dt>
                        <dd className="text-sm font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Ownership Distribution from cap table */}
          {capTable && capTable.rows.length > 0 && (
            <SectionCard title="Ownership Distribution">
              <OwnershipBarChart rows={capTable.rows} />
            </SectionCard>
          )}
        </>
      )}

      {/* ── Investors Tab ── */}
      {tab === "Investors" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Investors" value={data.lpCount} />
            <MetricCard label="Eligible Wallets" value={data.eligibleWalletCount} />
            <MetricCard label="Settled" value={data.settledSubscriptions} />
            <MetricCard label="Pending" value={data.pendingSubscriptions} />
          </div>

          <SectionCard title="Investor Registry">
            {!investors || investors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No investors registered yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium text-muted-foreground px-6 py-3 uppercase text-xs tracking-wider">Name</th>
                      <th className="text-left font-medium text-muted-foreground px-6 py-3 uppercase text-xs tracking-wider">Email</th>
                      <th className="text-left font-medium text-muted-foreground px-6 py-3 uppercase text-xs tracking-wider">Wallet</th>
                      <th className="text-left font-medium text-muted-foreground px-6 py-3 uppercase text-xs tracking-wider">Status</th>
                      <th className="text-left font-medium text-muted-foreground px-6 py-3 uppercase text-xs tracking-wider">Eligibility</th>
                      {capTable && <th className="text-right font-medium text-muted-foreground px-6 py-3 uppercase text-xs tracking-wider">Ownership</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {investors.map((inv) => {
                      const ownership = capTable?.rows.find(r => r.investorId === inv.investorId);
                      return (
                        <tr key={inv.investorId} className="hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-3 font-medium">{inv.legalName}</td>
                          <td className="px-6 py-3 text-muted-foreground">{inv.email}</td>
                          <td className="px-6 py-3 text-muted-foreground">
                            {inv.wallets?.[0]?.address
                              ? <ExplorerLink value={inv.wallets[0].address} type="address" />
                              : "No wallet"}
                          </td>
                          <td className="px-6 py-3"><StatusBadge status={inv.verificationStatus} /></td>
                          <td className="px-6 py-3">
                            <StatusBadge status={inv.fundEligibility?.status ?? "N/A"} />
                          </td>
                          {capTable && (
                            <td className="px-6 py-3 text-right font-medium">
                              {ownership ? pct(ownership.ownershipPct) : "0.0%"}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}

      {/* ── Sustainability Tab ── */}
      {tab === "Sustainability" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard label="On-Chain Records" value={data.settledSubscriptions + data.eligibleWalletCount} />
            <MetricCard label="Verified Identities" value={data.lpCount} />
            <MetricCard label="Eligible Wallets" value={data.eligibleWalletCount} />
            <MetricCard
              label="Compliance Standard"
              value="ERC-3643"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Compliance & Governance">
              <dl className="space-y-3">
                {[
                  ["Token Standard", "ERC-3643 Security Token"],
                  ["Transfer Restrictions", "Identity Registry + LP Eligibility"],
                  ["Settlement Validation", "3-Way Match (Amount, Identity, Reference)"],
                  ["Document Anchoring", "SHA-256 Hash + On-Chain Timestamp"],
                  ["Identity Verification", `${data.lpCount} verified investors`],
                  ["Wallet Eligibility", `${data.eligibleWalletCount} eligible wallets`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-border pb-2 last:border-0">
                    <dt className="text-sm text-muted-foreground">{k}</dt>
                    <dd className="text-sm font-medium text-card-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>

            <SectionCard title="Transparency Metrics">
              <dl className="space-y-3">
                {[
                  ["Immutable Ledger", "All ownership changes recorded on-chain"],
                  ["Audit Trail", "Full document provenance with hash verification"],
                  ["Real-Time Cap Table", "Reads directly from blockchain state"],
                  ["No Manual Reconciliation", "Automated settlement + ownership tracking"],
                  ["Non-Custodial", "Investors control their own wallet keys"],
                  ["Deterministic Enforcement", "Rules enforced before violations, not after"],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col border-b border-border pb-2 last:border-0">
                    <dt className="text-sm font-medium text-card-foreground">{k}</dt>
                    <dd className="text-xs text-muted-foreground mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
