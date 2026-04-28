import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/angainor/PageHeader";
import { ErrorAlert } from "@/components/angainor/ErrorAlert";
import { SkeletonCard, TableSkeleton } from "@/components/angainor/Skeleton";
import { DerivedAmount } from "@/components/angainor/DerivedAmount";
import type { DerivationStep } from "@/components/angainor/DerivedAmount";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import {
  getInvestorCapitalAccount,
  exportCapitalAccount,
} from "@/services/investor-portal.service";
import { toFriendlyMessage } from "@/lib/errorMessages";
import { useCurrentFund } from "@/hooks/useCurrentFund";

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

interface DerivedRowConfig {
  readonly label: string;
  readonly formula?: string;
  readonly steps: ReadonlyArray<DerivationStep>;
  readonly result: number;
  readonly asOf?: string;
}

function StatementRow({
  label,
  value,
  sublabel,
  isTotal = false,
  even = false,
  derivation,
}: {
  readonly label: string;
  readonly value: string;
  readonly sublabel?: string;
  readonly isTotal?: boolean;
  readonly even?: boolean;
  readonly derivation?: DerivedRowConfig;
}) {
  const amountNode = (
    <span
      className={`text-sm tabular-nums ${
        isTotal
          ? "font-semibold text-foreground"
          : "font-medium text-foreground"
      }`}
    >
      {value}
    </span>
  );

  return (
    <div
      className={`flex items-center justify-between px-5 py-3.5 ${
        even ? "bg-muted" : "bg-card"
      } ${isTotal ? "border-t-2 border-border" : ""}`}
    >
      <div>
        <span
          className={`text-sm ${isTotal ? "font-semibold text-foreground" : "text-foreground"}`}
        >
          {label}
        </span>
        {sublabel && (
          <span className="ml-2 text-xs text-muted-foreground">{sublabel}</span>
        )}
      </div>
      {derivation ? (
        <DerivedAmount
          amount={amountNode}
          label={derivation.label}
          formula={derivation.formula}
          steps={derivation.steps}
          result={fmt(derivation.result)}
          asOf={derivation.asOf}
        />
      ) : (
        amountNode
      )}
    </div>
  );
}

function EmptyCapitalAccount() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.5} />
      <p className="text-sm font-medium text-muted-foreground">
        No capital account data available yet
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Your capital account statement will appear here once your investment is
        settled.
      </p>
    </div>
  );
}

export default function InvestorCapitalAccount() {
  const fundId = DEFAULT_FUND_CODE;
  const { waterfallConfig } = useCurrentFund();

  const prefReturnLabel =
    typeof waterfallConfig?.prefReturnPct === "number"
      ? `${waterfallConfig.prefReturnPct}% p.a.`
      : "—";

  const lastTier = waterfallConfig?.rules?.tiers?.[
    (waterfallConfig?.rules?.tiers?.length ?? 0) - 1
  ];
  const carriedInterestLabel = lastTier
    ? `${lastTier.lpShare}/${lastTier.gpShare} LP/GP`
    : "—";

  const { data: account, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.investorCapitalAccount(fundId),
    queryFn: () => getInvestorCapitalAccount(fundId).then((r) => r.data),
  });

  const handleExport = async () => {
    try {
      await exportCapitalAccount('csv', fundId);
    } catch (err) {
      toast.error(toFriendlyMessage(err));
    }
  };

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <TableSkeleton rows={5} columns={3} />
    </div>
  );
  if (error)
    return (
      <ErrorAlert
        title="Failed to load capital account"
        message={(error as Error).message}
      />
    );

  // Build derivations from the statement values. All derivations are
  // client-side from the existing CapitalAccountStatement payload.
  const initialContribution = account ? Number(account.initialContribution) : 0;
  const openingBalance = account ? Number(account.openingBalance) : 0;
  const capitalReturned = account ? Number(account.capitalReturned) : 0;
  const accruedPreferredReturn = account
    ? Number(account.accruedPreferredReturn)
    : 0;
  const residualAllocation = account ? Number(account.residualAllocation) : 0;
  const distributionsReceived = account
    ? Number((account as Record<string, unknown>).distributionsReceived ?? 0)
    : 0;
  const endingBalance = account ? Number(account.endingBalance) : 0;

  const initialContributionDerivation: DerivedRowConfig | undefined = account
    ? {
        label: "Initial Contribution",
        formula: "Settled subscription amount at fund close",
        steps: [
          {
            label: "Subscription commitment (signed LPA)",
            value: fmt(initialContribution),
            sourceRef: {
              kind: "subscription",
              id: account.id,
              route: "/subscriptions",
              label: "View subscription",
            },
          },
        ],
        result: initialContribution,
        asOf: account.asOfDate,
      }
    : undefined;

  const openingBalanceDerivation: DerivedRowConfig | undefined = account
    ? {
        label: "Opening Balance",
        formula: "Balance carried forward from last period",
        steps: [
          {
            label: "Prior period ending balance",
            value: fmt(openingBalance),
          },
        ],
        result: openingBalance,
        asOf: account.asOfDate,
      }
    : undefined;

  const capitalReturnedDerivation: DerivedRowConfig | undefined = account
    ? {
        label: "Return of Capital",
        formula: "Sum of all return-of-capital distributions to date",
        steps: [
          {
            label: "Cumulative return-of-capital distributions",
            value: fmt(capitalReturned),
            sourceRef: {
              kind: "distribution",
              id: account.id,
              route: "/investor/distributions",
              label: "View distribution history",
            },
          },
        ],
        result: capitalReturned,
        asOf: account.asOfDate,
      }
    : undefined;

  const accruedPrefDerivation: DerivedRowConfig | undefined = account
    ? {
        label: "Preferred Return Accrued",
        formula: "Committed capital × preferred rate × days / 365",
        steps: [
          {
            label: "Contributed capital",
            value: fmt(initialContribution),
            sourceRef: {
              kind: "subscription",
              id: account.id,
            },
          },
          {
            label: "Preferred return tier (LPA)",
            value: prefReturnLabel,
            formula: "× simple annual rate",
          },
          {
            label: "Time-weighted accrual",
            value: fmt(accruedPreferredReturn),
            formula: "= cumulative running total",
          },
        ],
        result: accruedPreferredReturn,
        asOf: account.asOfDate,
      }
    : undefined;

  const distributionsReceivedDerivation: DerivedRowConfig | undefined = account
    ? {
        label: "Distributions Received",
        formula: "Sum of all distribution payments (gross)",
        steps: [
          {
            label: "Cumulative gross distributions",
            value: fmt(distributionsReceived),
            sourceRef: {
              kind: "distribution",
              id: account.id,
              route: "/investor/distributions",
              label: "View history",
            },
          },
        ],
        result: distributionsReceived,
        asOf: account.asOfDate,
      }
    : undefined;

  const residualDerivation: DerivedRowConfig | undefined = account
    ? {
        label: "Residual Allocation",
        formula: "Pro-rata share of profits above preferred return",
        steps: [
          {
            label: `Carried interest tier share (${carriedInterestLabel})`,
            value: fmt(residualAllocation),
          },
        ],
        result: residualAllocation,
        asOf: account.asOfDate,
      }
    : undefined;

  // Ending balance: opening + contributions − capital returned + accrued pref + residual − distributions received
  // Ending balance is delivered from backend; we explain it as: initial + accrued pref + residual − capital returned
  const endingDerivation: DerivedRowConfig | undefined = account
    ? {
        label: "Closing Balance",
        formula:
          "Initial + Preferred Accrued + Residual − Capital Returned − Distributions Received",
        steps: [
          { label: "Initial contribution", value: fmt(initialContribution), formula: "+" },
          {
            label: "Preferred return accrued",
            value: fmt(accruedPreferredReturn),
            formula: "+",
          },
          { label: "Residual allocation", value: fmt(residualAllocation), formula: "+" },
          {
            label: "Return of capital received",
            value: fmt(capitalReturned),
            formula: "−",
          },
          {
            label: "Distributions received",
            value: fmt(distributionsReceived),
            formula: "−",
          },
        ],
        result: endingBalance,
        asOf: account.asOfDate,
      }
    : undefined;

  return (
    <div>
      <PageHeader
        title="Capital Account"
        subtitle="Your capital account statement"
        action={
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export Statement
          </button>
        }
      />

      {!account ? (
        <EmptyCapitalAccount />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Statement Header */}
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold text-foreground">
              Capital Account Statement
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              As of {fmtDate(account.asOfDate)}
            </p>
          </div>

          {/* Statement Rows */}
          <div>
            <StatementRow
              label="Initial Contribution"
              value={fmt(initialContribution)}
              sublabel={account.asOfDate ? `Settled ${new Date(account.asOfDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Initial settlement'}
              even={false}
              derivation={initialContributionDerivation}
            />
            <StatementRow
              label="Opening Balance"
              value={fmt(openingBalance)}
              sublabel={`as of ${fmtDate(account.asOfDate)}`}
              even
              derivation={openingBalanceDerivation}
            />
            <StatementRow
              label="Contributions"
              value={fmt(initialContribution)}
              sublabel="Initial contribution"
              even={false}
              derivation={initialContributionDerivation}
            />
            <StatementRow
              label="Return of Capital Received"
              value={fmt(capitalReturned)}
              even
              derivation={capitalReturnedDerivation}
            />
            <StatementRow
              label="Preferred Return Accrued"
              value={fmt(accruedPreferredReturn)}
              sublabel="Running total"
              even={false}
              derivation={accruedPrefDerivation}
            />
            <StatementRow
              label="Distributions Received"
              value={fmt(distributionsReceived)}
              even
              derivation={distributionsReceivedDerivation}
            />
            <StatementRow
              label="Residual Allocation"
              value={fmt(residualAllocation)}
              even={false}
              derivation={residualDerivation}
            />
            <StatementRow
              label="Closing Balance"
              value={fmt(endingBalance)}
              isTotal
              even
              derivation={endingDerivation}
            />
          </div>
        </div>
      )}
    </div>
  );
}
