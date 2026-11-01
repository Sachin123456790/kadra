import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Download,
  FileText,
  Plus,
  Search,
  Sparkles,
  Upload,
  Activity,
} from "lucide-react";
import { SectionCard } from "@/components/angainor/SectionCard";
import { PageHeader } from "@/components/angainor/PageHeader";
import { currency, download, today } from "./api";
import { Button, ErrorBox } from "./ui";
import { fundUrl } from "./navigation";

export const cents = (value: string) => {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  return (
    (BigInt(whole || "0") * 100n + BigInt(fraction.padEnd(2, "0"))) *
    (negative ? -1n : 1n)
  );
};
export const decimal = (n: bigint) =>
  `${n < 0n ? "-" : ""}${(n < 0n ? -n : n) / 100n}.${((n < 0n ? -n : n) % 100n).toString().padStart(2, "0")}`;
const dateLabel = (value: string) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "—";

export function Portfolio({ data, error, loading, retry }: any) {
  const [filter, setFilter] = useState("");
  if (loading)
    return (
      <p className="text-sm text-muted-foreground">Loading your portfolio…</p>
    );
  if (error)
    return (
      <div className="space-y-3">
        <ErrorBox error={error} />
        <Button onClick={retry}>Retry portfolio</Button>
      </div>
    );
  const attention = (data?.funds || []).filter(
    (f: any) => f.review_documents || f.unreviewed_terms,
  );
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <PageHeader
        title="Portfolio"
        action={
          <Link className="cr-button" to="/funds/new">
            <Plus size={14} />
            Add new fund
          </Link>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Coming up"
          action={
            <span className="text-[10px] text-muted-foreground">
              from your reviewed terms
            </span>
          }
        >
          <div className="min-h-[168px] space-y-4">
            {data.upcoming.length ? (
              data.upcoming.map((r: any, i: number) => (
                <Link
                  key={i}
                  className="flex items-start gap-2 text-xs"
                  to={fundUrl("/waterfall", r.fundId)}
                >
                  <Clock3 size={13} className="mt-0.5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p>
                      {r.key.replaceAll("_", " ").replaceAll(".", " · ")} takes
                      effect
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {r.fundName} · Reviewed rule
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {dateLabel(r.effectiveFrom)}
                  </span>
                </Link>
              ))
            ) : (
              <div className="flex min-h-[168px] flex-col justify-center px-3">
                <Clock3 size={18} className="mb-3 text-primary" />
                <p className="text-xs">
                  No upcoming effective dates in reviewed terms.
                </p>
                <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
                  Confirm the fund’s governing terms to surface future changes
                  here.
                </p>
              </div>
            )}
          </div>
        </SectionCard>
        <SectionCard
          title="Recent chats"
          action={<Sparkles size={13} className="text-primary" />}
        >
          <div className="min-h-[168px] divide-y divide-border/60">
            {data.recent.length ? (
              data.recent.slice(0, 4).map((a: any) => (
                <Link
                  key={a.id}
                  to={fundUrl("/ask", a.fund_id, {
                    conversation: a.conversation_id || a.id,
                  })}
                  className="flex gap-3 py-2 first:pt-0 text-xs hover:text-primary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{a.question}</p>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                      {a.fund_name}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {dateLabel(a.created_at)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="py-10 text-xs text-muted-foreground">
                Open a fund and Ask to start your first conversation.
              </p>
            )}
          </div>
        </SectionCard>
      </div>
      <section>
        <h2 className="workspace-eyebrow mb-3">
          Needs attention <span className="ml-2">{attention.length}</span>
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {attention.length ? (
            attention.map((f: any) => (
              <Link
                key={f.id}
                to={fundUrl("/documents", f.id)}
                className="w-60 shrink-0 rounded-md border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="truncate">{f.name}</span>
                  <ArrowRight
                    size={12}
                    className="ml-auto shrink-0 text-muted-foreground"
                  />
                </div>
                <span className="cr-review-tag mt-2">
                  {f.review_documents} documents to review
                  {f.unreviewed_terms
                    ? ` · ${f.unreviewed_terms} term suggestions`
                    : ""}
                </span>
              </Link>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">
              No pending document reviews in this portfolio.
            </p>
          )}
        </div>
      </section>
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="workspace-eyebrow">Funds · {data.funds.length}</h2>
          <div className="relative w-full sm:w-80">
            <Search
              size={13}
              className="absolute left-2.5 top-2.5 text-muted-foreground"
            />
            <input
              className="cr-input w-full pl-8 text-xs"
              aria-label="Filter portfolio funds"
              placeholder="Filter by fund or strategy"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left">
            <thead>
              <tr>
                {[
                  "Fund",
                  "Source",
                  "Documents",
                  "Passages",
                  "Terms",
                  "Rules",
                  "Review",
                  "Last review",
                ].map((h) => (
                  <th
                    key={h}
                    className="border-b border-border px-4 py-3 font-medium uppercase text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.funds
                .filter((f: any) =>
                  `${f.name} ${f.onboarding?.strategy || ""}`
                    .toLowerCase()
                    .includes(filter.toLowerCase()),
                )
                .map((f: any) => (
                  <tr
                    key={f.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                  >
                    <td className="min-w-60 px-4 py-4">
                      <Link
                        className="font-medium hover:text-primary"
                        to={fundUrl("/dashboard", f.id)}
                      >
                        {f.name}
                        <ArrowUpRight size={12} className="ml-2 inline" />
                      </Link>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {f.onboarding?.strategy || "Real estate"}
                        {f.synthetic && (
                          <span className="ml-2 rounded border border-border px-1">
                            DEMO
                          </span>
                        )}
                      </p>
                      {f.onboarding?.step === 2 && (
                        <Link
                          to={fundUrl("/funds/new", f.id)}
                          className="mt-2 block text-[10px] text-primary"
                        >
                          Continue fund setup →
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {f.synthetic
                        ? "Synthetic demo fixture"
                        : "Private workspace"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      {f.ready_documents}/{f.documents}
                      <div className="mt-1.5 h-0.5 w-12 bg-muted">
                        <div
                          className="h-full bg-primary/70"
                          style={{
                            width: `${f.documents ? (f.ready_documents / f.documents) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4">{f.source_passages}</td>
                    <td className="px-4 py-4">{f.extracted_terms}</td>
                    <td className="px-4 py-4">{f.rules}</td>
                    <td className="px-4 py-4">
                      {f.review_documents ? (
                        <span className="cr-review-tag">
                          {f.review_documents} pending
                        </span>
                      ) : f.documents ? (
                        <span className="text-success">Reviewed</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">
                      {dateLabel(f.last_review)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!data.funds.length && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Add a fund to begin.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export function FundDashboard({ data }: any) {
  const [asOf, setAsOf] = useState(today());
  const investors = data.records.filter((r: any) => r.kind === "investor");
  const contributions = data.records.filter(
    (r: any) =>
      r.kind === "financial" &&
      r.data.category === "CONTRIBUTION" &&
      r.data.date <= asOf,
  );
  const committed = cents(data.totals.commitments);
  const received = contributions.reduce(
    (n: bigint, r: any) => n + cents(r.amount),
    0n,
  );
  const called = data.calls
    .filter((c: any) => c.status === "APPROVED" && c.as_of <= asOf)
    .reduce((n: bigint, c: any) => n + cents(c.amount), 0n);
  const rows = [
    ["Committed", currency(decimal(committed))],
    ["Approved calls", currency(decimal(called))],
    ["Received", currency(decimal(received))],
    ["Unfunded", currency(decimal(committed - received))],
    ["NAV", "—"],
    ["RVPI", "—"],
    ["Net IRR", "—"],
  ];
  const pendingDocs = data.documents.filter((d: any) => d.status !== "READY");
  const activeCalls = data.calls.filter((c: any) => c.status === "DRAFT");
  const exportOverview = () =>
    download(
      "fund-overview.csv",
      "\uFEFF" +
        [
          ["Fund", data.fund.name],
          ["Reporting date", asOf],
          [
            "Basis",
            "Current commitment snapshot; posted contributions through reporting date; USD",
          ],
          ...rows,
        ]
          .map((row) =>
            row
              .map(
                (value) =>
                  '"' +
                  (/^[=+@\-\t\r]/.test(value) ? "'" : "") +
                  value.replaceAll('"', '""') +
                  '"',
              )
              .join(","),
          )
          .join("\r\n"),
      "text/csv;charset=utf-8",
    );
  return (
    <div className="mx-auto max-w-[1600px]">
      <p className="mb-2 text-xs text-muted-foreground">{data.fund.name}</p>
      <PageHeader
        title="GP Dashboard"
        action={
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[10px] text-muted-foreground">
              Reporting date
              <input
                type="date"
                className="cr-input mt-1 block text-xs"
                aria-label="Reporting date"
                value={asOf}
                onChange={(e) => e.target.value && setAsOf(e.target.value)}
              />
            </label>
            <Link
              className="cr-button-secondary"
              to={fundUrl("/documents", data.fund.id)}
            >
              <Upload size={13} />
              Add source documents
            </Link>
            <button className="cr-button-secondary" onClick={exportOverview}>
              <Download size={13} />
              Export CSV
            </button>
          </div>
        }
      />
      <p className="mb-5 text-[11px] text-muted-foreground">
        USD · Current commitments and records through {asOf}. Unresolved values
        appear as —.
      </p>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(270px,0.85fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <SectionCard title="Overview">
            <dl>
              {rows.map(([label, value]) => (
                <div key={label} className="overview-row">
                  <dt>{label}</dt>
                  <dd>
                    <Link
                      to={fundUrl(
                        label === "Committed"
                          ? "/investors"
                          : label === "Approved calls"
                            ? "/settlement"
                            : "/financial",
                        data.fund.id,
                      )}
                      className="hover:text-primary"
                    >
                      {value}
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">
              {investors.length} investors · As of {asOf}
              <br />
              Unfunded = commitments less posted contributions. Approved calls
              exclude historic contributions without a call record.
            </p>
          </SectionCard>
          <SectionCard title="Requiring attention">
            <div className="space-y-2">
              {pendingDocs.length > 0 && (
                <Link
                  className="overview-link"
                  to={fundUrl("/documents", data.fund.id)}
                >
                  {pendingDocs.length} documents awaiting review
                  <ArrowUpRight size={13} />
                </Link>
              )}
              {activeCalls.length > 0 && (
                <Link
                  className="overview-link"
                  to={fundUrl("/settlement", data.fund.id)}
                >
                  {activeCalls.length} draft capital calls
                  <ArrowUpRight size={13} />
                </Link>
              )}
              {data.fund.onboarding?.step === 2 && (
                <Link
                  className="overview-link"
                  to={fundUrl("/funds/new", data.fund.id)}
                >
                  Continue fund setup
                  <ArrowUpRight size={13} />
                </Link>
              )}
              {!pendingDocs.length && !activeCalls.length && (
                <p className="text-xs text-muted-foreground">
                  No outstanding actions in the available records.
                </p>
              )}
            </div>
          </SectionCard>
          <SectionCard
            title="Recent updates"
            action={
              <Link
                to={fundUrl("/audit", data.fund.id)}
                className="text-[10px] text-primary"
              >
                View all
              </Link>
            }
          >
            <div className="space-y-4">
              {data.events
                .filter((e: any) => e.fund_id === data.fund.id)
                .slice(0, 4)
                .map((e: any) => (
                  <div key={e.id} className="flex gap-2 text-xs">
                    <Activity
                      size={13}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                    <div>
                      <p className="capitalize">
                        {e.action.toLowerCase().replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {dateLabel(e.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </SectionCard>
        </div>
        <div className="space-y-4">
          <SectionCard title="Performance">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-medium">NAV history</h2>
              <span className="text-[10px] text-muted-foreground">
                Awaiting verified NAV
              </span>
            </div>
            <div className="cr-chart-grid flex min-h-[310px] items-center justify-center">
              <div className="max-w-sm rounded-lg border border-border bg-card p-6 text-center">
                <Activity size={20} className="mx-auto mb-3 text-primary" />
                <h3 className="text-sm font-medium">
                  Build your fund’s performance history
                </h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Fund NAV and return calculations require a verified valuation
                  history. Uploaded spreadsheets are retained as evidence for
                  review.
                </p>
                <Link
                  className="cr-button-secondary mt-4"
                  to={fundUrl("/financial", data.fund.id)}
                >
                  Review financial records
                </Link>
              </div>
            </div>
          </SectionCard>
          <SectionCard
            title="Capital position"
            action={
              <Link
                className="text-[10px] text-primary"
                to={fundUrl("/reports", data.fund.id)}
              >
                View investor accounts →
              </Link>
            }
          >
            <div className="space-y-4">
              {[
                ["Committed", committed],
                ["Approved calls", called],
                ["Received", received],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {String(label)}
                    </span>
                    <span>{currency(decimal(value as bigint))}</span>
                  </div>
                  <div className="h-1.5 rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary/65"
                      style={{
                        width: `${committed > 0n ? Math.min(100, Math.max(0, Number(((value as bigint) * 10000n) / committed) / 100)) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard
            title="Fund sources"
            action={
              <Link
                to={fundUrl("/documents", data.fund.id)}
                className="text-[10px] text-primary"
              >
                View all
              </Link>
            }
          >
            <div className="space-y-3">
              {data.documents.slice(0, 4).map((d: any) => (
                <Link
                  key={d.id}
                  className="flex items-center gap-3 text-xs"
                  to={fundUrl("/documents", data.fund.id)}
                >
                  <FileText size={14} className="text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{d.filename}</span>
                  <span className="text-[10px] text-muted-foreground">
                    v{d.version} · {d.status.replaceAll("_", " ").toLowerCase()}
                  </span>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
