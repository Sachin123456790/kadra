import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/kadra/PageHeader";
import { ErrorAlert } from "@/components/kadra/ErrorAlert";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getInvestorCapitalAccount } from "@/services/investor-portal.service";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

function StatementRow({
  label,
  value,
  sublabel,
  isTotal = false,
  even = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly sublabel?: string;
  readonly isTotal?: boolean;
  readonly even?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-5 py-3.5 ${
        even ? "bg-gray-50" : "bg-white"
      } ${isTotal ? "border-t-2 border-gray-300" : ""}`}
    >
      <div>
        <span
          className={`text-sm ${isTotal ? "font-semibold text-gray-900" : "text-gray-700"}`}
        >
          {label}
        </span>
        {sublabel && (
          <span className="ml-2 text-xs text-gray-400">{sublabel}</span>
        )}
      </div>
      <span
        className={`text-sm tabular-nums ${isTotal ? "font-semibold text-gray-900" : "font-medium text-gray-900"}`}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyCapitalAccount() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="h-12 w-12 text-indigo-300 mb-4" strokeWidth={1.5} />
      <p className="text-sm font-medium text-gray-600">
        No capital account data available yet
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Your capital account statement will appear here once your investment is
        settled.
      </p>
    </div>
  );
}

export default function InvestorCapitalAccount() {
  const fundId = DEFAULT_FUND_CODE;

  const { data: account, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorCapitalAccount(fundId),
    queryFn: () => getInvestorCapitalAccount(fundId).then((r) => r.data),
  });

  const handleExport = () => {
    toast.info("Export feature coming soon");
  };

  if (isLoading) return <div className="p-6 text-gray-500">Loading...</div>;
  if (error)
    return (
      <ErrorAlert
        title="Failed to load capital account"
        message={(error as Error).message}
      />
    );

  return (
    <div>
      <PageHeader
        title="Capital Account"
        subtitle="Your capital account statement"
        action={
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export Statement
          </button>
        }
      />

      {!account ? (
        <EmptyCapitalAccount />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* Statement Header */}
          <div className="border-b border-gray-200 px-5 py-4">
            <h3 className="text-base font-semibold text-gray-900">
              Capital Account Statement
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              As of {fmtDate(account.asOfDate)}
            </p>
          </div>

          {/* Statement Rows */}
          <div>
            <StatementRow
              label="Opening Balance"
              value={fmt(Number(account.openingBalance))}
              sublabel={`as of ${fmtDate(account.asOfDate)}`}
              even={false}
            />
            <StatementRow
              label="Contributions"
              value={fmt(Number(account.initialContribution))}
              sublabel="Initial contribution"
              even
            />
            <StatementRow
              label="Return of Capital Received"
              value={fmt(Number(account.capitalReturned))}
              even={false}
            />
            <StatementRow
              label="Preferred Return Accrued"
              value={fmt(Number(account.accruedPreferredReturn))}
              sublabel="Running total"
              even
            />
            <StatementRow
              label="Distributions Received"
              value={fmt(Number((account as Record<string, unknown>).distributionsReceived ?? 0))}
              even={false}
            />
            <StatementRow
              label="Residual Allocation"
              value={fmt(Number(account.residualAllocation))}
              even
            />
            <StatementRow
              label="Closing Balance"
              value={fmt(Number(account.endingBalance))}
              isTotal
              even={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
