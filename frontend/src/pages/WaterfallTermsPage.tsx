import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/angainor/PageHeader";
import { SectionCard } from "@/components/angainor/SectionCard";
import { ErrorAlert } from "@/components/angainor/ErrorAlert";
import { EmptyState } from "@/components/angainor/EmptyState";
import { Button } from "@/components/ui/button";
import { DEFAULT_FUND_CODE, QUERY_KEYS } from "@/config/constants";
import { getWaterfallConfig } from "@/services";

export default function WaterfallTermsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEYS.waterfallConfig(DEFAULT_FUND_CODE),
    queryFn: () => getWaterfallConfig(DEFAULT_FUND_CODE).then((r) => r.data),
  });
  return (
    <div>
      <PageHeader
        title="Waterfall Terms"
        subtitle="The active configuration used by this fund’s distribution workflow."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/distribution">Open distributions</Link>
          </Button>
        }
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          Loading waterfall terms…
        </p>
      ) : error ? (
        <ErrorAlert
          title="Unable to load waterfall terms"
          message={(error as Error).message}
        />
      ) : !data ? (
        <EmptyState
          title="No active waterfall"
          message="Review the governing documents before configuring distributions."
        />
      ) : (
        <div className="space-y-4">
          <SectionCard title={`Active configuration · Version ${data.version}`}>
            <dl className="grid gap-x-8 sm:grid-cols-2">
              {[
                ["Calculation basis", data.calculationBasis],
                ["Frequency", data.distributionFrequency],
                ["Preferred return", `${data.prefReturnPct}%`],
                ["GP promote", `${data.gpPromotePct}%`],
                ["Catch-up", data.catchUpEnabled ? "Enabled" : "Disabled"],
              ].map(([label, value]) => (
                <div className="overview-row" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
          <SectionCard title="Distribution tiers">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-3">Tier</th>
                    <th className="p-3">Hurdle</th>
                    <th className="p-3">LP share</th>
                    <th className="p-3">GP share</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.rules?.tiers ?? []).map((tier, index) => (
                    <tr
                      key={`${index}-${tier.name}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-4">{tier.name}</td>
                      <td className="p-3">{tier.hurdle}</td>
                      <td className="p-3">{tier.lpShare}%</td>
                      <td className="p-3">{tier.gpShare}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.rules?.tiers?.length && (
                <p className="py-6 text-sm text-muted-foreground">
                  No tier details are available.
                </p>
              )}
            </div>
          </SectionCard>
          <p className="text-xs leading-relaxed text-muted-foreground">
            These are the configured calculation terms. Review the governing
            documents and investor exceptions before running a distribution.{" "}
            <Link className="text-primary hover:underline" to="/documents">
              Open source documents
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
