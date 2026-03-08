import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { PageHeader } from "@/components/kadra/PageHeader";
import { SectionCard } from "@/components/kadra/SectionCard";
import { DataTable, Column } from "@/components/kadra/DataTable";
import { StatusBadge } from "@/components/kadra/StatusBadge";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { EmptyState } from "@/components/kadra/EmptyState";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getMyDistributions } from "@/services";
import type { InvestorDistributionLineItem } from "@/services/investor-portal.service";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const columns: Column<InvestorDistributionLineItem>[] = [
  { key: "run", header: "Run Date", render: (r) => new Date(r.run.asOfTimestamp).toLocaleDateString() },
  { key: "run", header: "Status", render: (r) => <StatusBadge status={r.run.runStatus} /> },
  { key: "ownershipPctUsed", header: "Ownership %", render: (r) => r.ownershipPctUsed != null ? `${r.ownershipPctUsed}%` : "--" },
  { key: "grossAmount", header: "Gross Amount", render: (r) => fmt(Number(r.grossAmount)) },
  { key: "netAmount", header: "Net Amount", render: (r) => fmt(Number(r.netAmount)) },
  { key: "currency", header: "Currency" },
];

interface BarEntry {
  date: string;
  gross: number;
  net: number;
}

interface CumulativeEntry {
  date: string;
  cumulative: number;
}

function DistributionBarChart({ items }: { items: InvestorDistributionLineItem[] }) {
  const barData: BarEntry[] = items.map((item) => ({
    date: new Date(item.run.asOfTimestamp).toLocaleDateString(),
    gross: Number(item.grossAmount),
    net: Number(item.netAmount),
  }));

  return (
    <SectionCard>
      <h3 className="text-sm font-medium text-gray-600 mb-4">Distribution History</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={barData}>
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6b7280" }} />
          <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(v: number) => fmt(v)} />
          <ReTooltip formatter={(value: number) => fmt(value)} />
          <Legend />
          <Bar dataKey="gross" name="Gross" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
          <Bar dataKey="net" name="Net" fill="#4338ca" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

function CumulativeAreaChart({ items }: { items: InvestorDistributionLineItem[] }) {
  const areaData: CumulativeEntry[] = useMemo(() => {
    const sorted = [...items].sort(
      (a, b) => new Date(a.run.asOfTimestamp).getTime() - new Date(b.run.asOfTimestamp).getTime()
    );
    let cumulative = 0;
    return sorted.map((item) => {
      cumulative += Number(item.netAmount);
      return {
        date: new Date(item.run.asOfTimestamp).toLocaleDateString(),
        cumulative,
      };
    });
  }, [items]);

  return (
    <SectionCard>
      <h3 className="text-sm font-medium text-gray-600 mb-4">Cumulative Distributions</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={areaData}>
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6b7280" }} />
          <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(v: number) => fmt(v)} />
          <ReTooltip formatter={(value: number) => fmt(value)} />
          <Area
            type="monotone"
            dataKey="cumulative"
            name="Cumulative Net"
            stroke="#4f46e5"
            fill="#4f46e5"
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

export default function InvestorDistributionsPage() {
  const fundId = DEFAULT_FUND_CODE;

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorDistributions(fundId),
    queryFn: () => getMyDistributions(fundId).then((r) => r.data),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error) return <ErrorAlert title="Failed to load distributions" message={(error as Error).message} />;
  if (!data || data.length === 0) {
    return (
      <div>
        <PageHeader title="My Distributions" subtitle="Your distribution history" />
        <EmptyState title="No distributions" message="No distributions have been issued to your account yet." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Distributions" subtitle="Your distribution history" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <DistributionBarChart items={data} />
        <CumulativeAreaChart items={data} />
      </div>
      <SectionCard>
        <DataTable columns={columns} data={data} getRowId={(r) => r.id} />
      </SectionCard>
    </div>
  );
}
