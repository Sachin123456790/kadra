import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, FileText, ClipboardList, CheckCircle, ArrowLeftRight,
  PieChart, Table, Shield, Search, Menu, X,
  Sun, Moon, Bell, LogOut, User, HelpCircle, ChevronDown, Wallet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, formatRelativeTime } from "@/hooks/useNotifications";
import { ADMIN_ROLES, DEFAULT_FUND_CODE, QUERY_KEYS } from "@/config/constants";
import { getFundOverview } from "@/services";

const adminNavItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Cap Table", path: "/cap-table", icon: Table },
  { label: "Distribution", path: "/distribution", icon: PieChart },
  { label: "Investors", path: "/investors", icon: Users },
  { label: "Documents", path: "/documents", icon: FileText },
  { label: "Subscriptions", path: "/subscriptions", icon: ClipboardList },
  { label: "Settlement", path: "/settlement", icon: CheckCircle },
  { label: "Transfers", path: "/transfers", icon: ArrowLeftRight },
  { label: "Audit & Exports", path: "/audit", icon: Shield },
];

const investorNavItems = [
  { label: "Dashboard", path: "/investor", icon: LayoutDashboard },
  { label: "Capital Account", path: "/investor/capital-account", icon: Wallet },
  { label: "Documents", path: "/investor/documents", icon: FileText },
  { label: "Distributions", path: "/investor/distributions", icon: PieChart },
  { label: "Transfers", path: "/investor/transfers", icon: ArrowLeftRight },
  { label: "Profile", path: "/investor/profile", icon: User },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const isAdmin = user?.role && (ADMIN_ROLES as readonly string[]).includes(user.role);

  const { data: fundData } = useQuery({
    queryKey: QUERY_KEYS.fundOverview(DEFAULT_FUND_CODE),
    queryFn: () => getFundOverview(DEFAULT_FUND_CODE).then((r) => r.data),
    enabled: isAdmin === true,
    staleTime: 60_000,
  });

  const navItems = isAdmin ? adminNavItems : investorNavItems;
  const homeRoute = isAdmin ? "/dashboard" : "/investor";
  const profileRoute = isAdmin ? "/profile" : "/investor/profile";

  // Show the 5 most recent notifications in dropdown
  const recentNotifications = Array.isArray(notifications) ? notifications.slice(0, 5) : [];
  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "KA";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="h-14 bg-topbar flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button className="lg:hidden text-topbar-foreground" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to={homeRoute} className="text-lg font-bold text-topbar-foreground tracking-tight">Angainor</Link>
          {isAdmin && fundData && (
            <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-topbar-foreground/20">
              <span className="text-sm font-medium text-topbar-foreground/80">{fundData.fundName}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-green-500/20 text-green-300">
                {fundData.status === "ACTIVE" ? "Active" : fundData.status}
              </span>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center bg-topbar-foreground/10 rounded-md px-3 py-1.5 w-72">
          <Search className="h-4 w-4 text-topbar-foreground/60 mr-2" />
          <input
            type="text"
            placeholder="Quick Search..."
            className="bg-transparent text-sm text-topbar-foreground placeholder:text-topbar-foreground/50 outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-1">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="p-2 rounded-md text-topbar-foreground/70 hover:text-topbar-foreground hover:bg-topbar-foreground/10 transition-colors"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative p-2 rounded-md text-topbar-foreground/70 hover:text-topbar-foreground hover:bg-topbar-foreground/10 transition-colors">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">{unreadCount} new</span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recentNotifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                recentNotifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex flex-col items-start gap-1 py-2.5 cursor-pointer"
                    onClick={() => markAsRead(n.id)}
                  >
                    <div className="flex items-start gap-2 w-full">
                      {!n.read && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                      <span className={cn("text-sm leading-snug", !n.read ? "font-medium" : "text-muted-foreground")}>
                        {n.message}
                      </span>
                    </div>
                    <span className={cn("text-xs text-muted-foreground", !n.read && "ml-3.5")}>
                      {formatRelativeTime(n.timestamp)}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="justify-center text-xs text-muted-foreground cursor-pointer"
                onClick={() => navigate("/notifications")}
              >
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Profile / Account */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 ml-1 pl-2 pr-1 py-1 rounded-md hover:bg-topbar-foreground/10 transition-colors">
                <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                  {initials}
                </div>
                <span className="hidden md:block text-sm text-topbar-foreground/90 max-w-[120px] truncate">
                  {user?.email || "Admin"}
                </span>
                <ChevronDown className="h-3 w-3 text-topbar-foreground/50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{user?.email || "Loading..."}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role || "Loading..."}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer gap-2" asChild>
                <Link to={profileRoute}>
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2" asChild>
                <Link to="/help">
                  <HelpCircle className="h-4 w-4" />
                  Help & Support
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={cn(
          "w-56 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col overflow-y-auto transition-transform duration-200 z-20",
          "lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0 fixed inset-y-14 left-0" : "-translate-x-full fixed inset-y-14 left-0 lg:translate-x-0 lg:static"
        )}>
          <nav className="flex-1 py-4 px-3 space-y-0.5">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-success" />
              System Online
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && <div className="fixed inset-0 bg-foreground/20 z-10 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in motion-reduce:animate-none">{children}</main>
      </div>
    </div>
  );
}
