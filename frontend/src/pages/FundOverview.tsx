import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  Download,
  FileText,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/angainor/PageHeader";
import { SectionCard } from "@/components/angainor/SectionCard";
import { ErrorAlert } from "@/components/angainor/ErrorAlert";
import { EmptyState } from "@/components/angainor/EmptyState";
import { SkeletonCard } from "@/components/angainor/Skeleton";
import { ActivityFeed } from "@/components/angainor/ActivityFeed";
import { TechnicalDetails } from "@/components/angainor/TechnicalDetails";
import { ExplorerLink } from "@/components/angainor/ExplorerLink";
import { Button } from "@/components/ui/button";
import { QUERY_KEYS, DEFAULT_FUND_CODE } from "@/config/constants";
import { getFundOverview, getActivityFeed, getDocuments } from "@/services";
import { getCapitalCalls } from "@/services/capital-calls.service";
import {
  displayMoney,
  issuedCapital,
  recordedAmount,
} from "@/lib/fund-overview";

export default function FundOverviewPage() {
  const fundId = DEFAULT_FUND_CODE;
  const fund = useQuery({
    queryKey: QUERY_KEYS.fundOverview(fundId),
    queryFn: () => getFundOverview(fundId).then((r) => r.data),
  });
  const activity = useQuery({
    queryKey: QUERY_KEYS.activityFeed(fundId),
    queryFn: () => getActivityFeed(fundId, 20).then((r) => r.data),
    refetchInterval: 30_000,
  });
  const calls = useQuery({
    queryKey: QUERY_KEYS.capitalCalls(fundId),
    queryFn: () => getCapitalCalls(fundId).then((r) => r.data),
  });
  const documents = useQuery({
    queryKey: QUERY_KEYS.documents(fundId),
    queryFn: () => getDocuments(fundId).then((r) => r.data),
  });

  if (fund.isLoading)
    return (
      <div
        className="grid gap-4 lg:grid-cols-3"
        aria-label="Loading fund overview"
      >
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  if (fund.error)
    return (
      <ErrorAlert
        title="Unable to load fund overview"
        message={(fund.error as Error).message}
      />
    );
  if (!fund.data)
    return (
      <EmptyState
        title="No fund data"
        message="Fund overview is not available yet."
      />
    );

  const data = fund.data;
  const committed = recordedAmount(data.totalCommittedAmount);
  const received = recordedAmount(data.totalSettledAmount);
  const called = calls.isError ? null : issuedCapital(calls.data);
  const unfunded =
    committed !== null && received !== null ? committed - received : null;
  const target = recordedAmount(data.targetCommitment);
  const unresolvedDocuments = documents.data?.filter(
    (doc) => doc.parseStatus !== "COMPLETED",
  );
  const activeCalls = calls.data?.filter((call) =>
    ["ISSUED", "PARTIALLY_RECEIVED"].includes(call.status),
  );
  const rows: [string, string][] = [
    ["Committed", displayMoney(committed)],
    ["Called", displayMoney(called)],
    ["Received", displayMoney(received)],
    ["Unfunded", displayMoney(unfunded)],
    ["NAV", "—"],
    ["RVPI", "—"],
    ["Net IRR", "—"],
  ];
  const capitalMetrics: [string, number | null][] = [
    ["Committed", committed],
    ["Called", called],
    ["Received", received],
  ];
  const exportOverview = () => {
    const escape = (value: string) =>
      `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
    const lines = [
      ["Fund", data.fundName],
      ["Basis", "Current records; USD; unavailable values are blank"],
      ["Exported at", new Date().toISOString()],
      ...rows.map(([label, value]) => [label, value === "—" ? "" : value]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + lines.map((row) => row.map(escape).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "fund-overview.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <p className="mb-1.5 text-xs text-muted-foreground">{data.fundName}</p>
      <PageHeader
        title="GP Dashboard"
        subtitle="USD · Current fund records. Unavailable values appear as —."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/documents?tab=upload">
                <Upload size={14} className="mr-2" />
                Add source documents
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={exportOverview}>
              <Download size={14} className="mr-2" />
              Export CSV
            </Button>
          </div>
        }
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4">
          <SectionCard title="Overview">
            <dl>
              {rows.map(([label, value]) => (
                <div className="overview-row" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
              {data.lpCount} investors · {data.status.replace(/_/g, " ")}
              <br />
              Unfunded = commitments less received capital. NAV and performance
              ratios are not connected.
            </p>
          </SectionCard>
          <SectionCard title="Requiring attention">
            <div className="space-y-2">
              {data.pendingSubscriptions > 0 && (
                <Link className="overview-link" to="/settlement">
                  <span>
                    {data.pendingSubscriptions} subscriptions awaiting
                    settlement
                  </span>
                  <ArrowUpRight size={14} />
                </Link>
              )}
              {activeCalls && activeCalls.length > 0 && (
                <Link className="overview-link" to="/settlement">
                  <span>
                    {activeCalls.length} open capital call
                    {activeCalls.length === 1 ? "" : "s"}
                  </span>
                  <ArrowUpRight size={14} />
                </Link>
              )}
              {unresolvedDocuments && unresolvedDocuments.length > 0 && (
                <Link className="overview-link" to="/documents">
                  <span>
                    {unresolvedDocuments.length} documents awaiting parsing
                  </span>
                  <ArrowUpRight size={14} />
                </Link>
              )}
              {(calls.isLoading || documents.isLoading) && (
                <p className="text-xs text-muted-foreground">
                  Checking capital calls and documents…
                </p>
              )}
              {(calls.isError || documents.isError) && (
                <p role="alert" className="text-xs text-destructive">
                  Some records could not be loaded. Attention checks are
                  incomplete.
                </p>
              )}
              {!calls.isLoading &&
                !documents.isLoading &&
                !calls.isError &&
                !documents.isError &&
                !data.pendingSubscriptions &&
                !activeCalls?.length &&
                !unresolvedDocuments?.length && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    No pending items in the loaded subscription, capital call,
                    and parsing records.
                  </p>
                )}
            </div>
          </SectionCard>
          <SectionCard
            title="Recent updates"
            action={
              <Link
                to="/audit"
                className="text-[11px] text-primary hover:underline"
              >
                View all
              </Link>
            }
          >
            {activity.isError ? (
              <p className="text-xs text-destructive">
                Recent activity could not be loaded.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                <ActivityFeed
                  events={activity.data ?? []}
                  isLoading={activity.isLoading}
                  maxItems={4}
                />
              </div>
            )}
          </SectionCard>
        </div>
        <div className="min-w-0 space-y-4">
          <SectionCard title="Performance">
            <div className="mb-5 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">NAV history</h2>
              <span className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground">
                Awaiting dated valuations
              </span>
            </div>
            <div
              className="relative flex min-h-64 items-center justify-center rounded-md border-b border-l border-border sm:min-h-80"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent, transparent calc(25% - 1px), hsl(var(--border) / .5) calc(25% - 1px), hsl(var(--border) / .5) 25%)",
              }}
            >
              <div className="z-10 mx-4 max-w-sm rounded-lg border border-border bg-card p-6 text-center">
                <Activity size={20} className="mx-auto mb-3 text-primary" />
                <h3 className="text-sm font-medium">
                  Connect a verified fund history
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  The MVP does not provide dated NAV snapshots yet. Review the
                  fund’s source documents while this view is being connected.
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link to="/documents">Review source documents</Link>
                </Button>
              </div>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              NAV history needs dated valuations and a data connection. Received
              capital is shown separately below.
            </p>
          </SectionCard>
          <SectionCard
            title="Capital position"
            action={
              <Link
                to="/cap-table"
                className="text-[11px] text-primary hover:underline"
              >
                View cap table
              </Link>
            }
          >
            <div className="grid gap-5 sm:grid-cols-3">
              {capitalMetrics.map(([label, amount]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1.5 text-lg font-medium tabular-nums">
                    {displayMoney(amount)}
                  </p>
                </div>
              ))}
            </div>
            {target !== null && target > 0 && committed !== null && (
              <div className="mt-5">
                <div className="mb-2 flex justify-between gap-3 text-[11px] text-muted-foreground">
                  <span>Committed toward target</span>
                  <span>{displayMoney(target)}</span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded bg-muted"
                  role="progressbar"
                  aria-label="Commitment target"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.max(
                    0,
                    Math.min(100, (committed / target) * 100),
                  )}
                >
                  <div
                    className="h-full rounded bg-primary"
                    style={{
                      width: `${Math.max(0, Math.min(100, (committed / target) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </SectionCard>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/documents" className="overview-link">
              <span className="flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                Source documents
              </span>
              <span className="text-muted-foreground">
                {documents.isError
                  ? "Unavailable"
                  : (documents.data?.length ?? "…")}
              </span>
            </Link>
            <Link to="/audit" className="overview-link">
              <span className="flex items-center gap-2">
                <Activity size={16} className="text-primary" />
                Activity & evidence exports
              </span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <SectionCard title="Fund details">
            <dl>
              <div className="overview-row">
                <dt>Legal form</dt>
                <dd>{data.legalForm || "—"}</dd>
              </div>
              <div className="overview-row">
                <dt>Fund status</dt>
                <dd>{data.status}</dd>
              </div>
            </dl>
            <TechnicalDetails label="Blockchain details">
              <div className="overview-row">
                <span className="text-muted-foreground">Contract</span>
                {data.tokenContract?.contractAddress ? (
                  <ExplorerLink
                    value={data.tokenContract.contractAddress}
                    type="address"
                  />
                ) : (
                  <span>Not deployed</span>
                )}
              </div>
            </TechnicalDetails>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
