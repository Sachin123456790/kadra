import {
  LayoutDashboard,
  FileText,
  Waves,
  Users,
  Building2,
  Wallet,
  PieChart,
  Activity,
  SlidersHorizontal,
  FileBarChart,
  HandCoins,
} from "lucide-react";

export const fundNavigation = [
  { path: "/dashboard", label: "GP Dashboard", icon: LayoutDashboard },
  { path: "/settlement", label: "Capital Calls", icon: HandCoins },
  { path: "/distribution", label: "Distributions", icon: PieChart },
  { path: "/properties", label: "SPVs & assets", icon: Building2 },
  { path: "/reports", label: "Investor reports", icon: FileBarChart },
  { path: "/documents", label: "Documents", icon: FileText },
  { path: "/waterfall", label: "Fund terms", icon: Waves },
  { path: "/investors", label: "Investors", icon: Users },
  { path: "/financial", label: "Financial records", icon: Wallet },
  { path: "/scenarios", label: "Scenario modeling", icon: SlidersHorizontal },
  { path: "/audit", label: "Activity & exports", icon: Activity },
];
export function fundUrl(
  path: string,
  fundId: string,
  extra: Record<string, string> = {},
) {
  return `${path}?${new URLSearchParams({ fund: fundId, ...extra })}`;
}
export function conversationItems(data: any) {
  return [
    ...(data?.conversations || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      date: c.updated_at || c.created_at,
    })),
    ...(data?.answers || [])
      .filter(
        (a: any) =>
          !a.conversation_id &&
          !(data?.conversations || []).some((c: any) => c.id === a.id),
      )
      .map((a: any) => ({ id: a.id, title: a.question, date: a.created_at })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
