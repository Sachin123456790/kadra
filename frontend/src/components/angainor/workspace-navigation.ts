import {
  Activity,
  ArrowLeftRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  PieChart,
  Table,
  Users,
  Waves,
} from "lucide-react";

// Every destination uses the existing, role-protected MVP workflow.
export const adminWorkspaceNavigation = [
  {
    label: "GP Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    group: "Fund workspace",
  },
  {
    label: "Capital Calls & Settlement",
    path: "/settlement",
    icon: Activity,
    group: "Fund workspace",
  },
  {
    label: "Documents",
    path: "/documents",
    icon: FileText,
    group: "Fund workspace",
  },
  {
    label: "Waterfall Terms",
    path: "/waterfall",
    icon: Waves,
    group: "Fund workspace",
  },
  {
    label: "Distributions",
    path: "/distribution",
    icon: PieChart,
    group: "Fund workspace",
  },
  { label: "Investors", path: "/investors", icon: Users, group: "Operations" },
  {
    label: "Subscriptions",
    path: "/subscriptions",
    icon: ClipboardList,
    group: "Operations",
  },
  { label: "Cap Table", path: "/cap-table", icon: Table, group: "Operations" },
  {
    label: "Transfers",
    path: "/transfers",
    icon: ArrowLeftRight,
    group: "Operations",
  },
  {
    label: "Activity & Exports",
    path: "/audit",
    icon: Activity,
    group: "Operations",
  },
];
