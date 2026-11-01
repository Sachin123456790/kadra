import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  PieChart,
  ArrowLeftRight,
  User,
  Wallet,
  Menu,
  X,
  Sun,
  Moon,
  Bell,
  LogOut,
  HelpCircle,
  ChevronDown,
  RotateCcw,
  Loader2,
  PanelLeftClose,
  MessageSquare,
  SlidersHorizontal,
  ArrowLeft,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resetDemoFund } from "@/services/audit.service";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, formatRelativeTime } from "@/hooks/useNotifications";
import { ADMIN_ROLES, DEFAULT_FUND_CODE, QUERY_KEYS, DEMO_MODE } from "@/config/constants";
import { getFundOverview } from "@/services";
import { adminWorkspaceNavigation } from "./workspace-navigation";
import { WorkspaceSearch } from "./WorkspaceSearch";

const investorNavItems = [
  {
    label: "Dashboard",
    path: "/investor",
    icon: LayoutDashboard,
    group: "Investor workspace",
  },
  {
    label: "Capital Account",
    path: "/investor/capital-account",
    icon: Wallet,
    group: "Investor workspace",
  },
  {
    label: "Documents",
    path: "/investor/documents",
    icon: FileText,
    group: "Investor workspace",
  },
  {
    label: "Distributions",
    path: "/investor/distributions",
    icon: PieChart,
    group: "Investor workspace",
  },
  {
    label: "Transfers",
    path: "/investor/transfers",
    icon: ArrowLeftRight,
    group: "Investor workspace",
  },
  {
    label: "Profile",
    path: "/investor/profile",
    icon: User,
    group: "Investor workspace",
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isCompact, setIsCompact] = useState(
    () => window.matchMedia("(max-width: 1023px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setIsCompact(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  useEffect(() => {
    if (!sidebarOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [sidebarOpen]);
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const isAdmin =
    !!user?.role && (ADMIN_ROLES as readonly string[]).includes(user.role);
  const { data: fundData } = useQuery({
    queryKey: QUERY_KEYS.fundOverview(DEFAULT_FUND_CODE),
    queryFn: () => getFundOverview(DEFAULT_FUND_CODE).then((r) => r.data),
    enabled: isAdmin,
    staleTime: 60_000,
  });
  const navItems = isAdmin ? adminWorkspaceNavigation : investorNavItems;
  const homeRoute = isAdmin ? "/dashboard" : "/investor";
  const profileRoute = isAdmin ? "/profile" : "/investor/profile";
  const currentPage =
    navItems.find(
      (item) =>
        location.pathname === item.path ||
        (item.path !== "/investor" &&
          location.pathname.startsWith(item.path + "/")),
    )?.label ??
    ({
      "/notifications": "Notifications",
      "/profile": "Settings",
      "/help": "Help & Support",
      "/admin/jobs": "Background Jobs",
    }[location.pathname] ||
      "Workspace");
  const recentNotifications = Array.isArray(notifications)
    ? notifications.slice(0, 5)
    : [];
  const initials = (user?.email?.substring(0, 2) || "AA").toUpperCase();

  return (
    <div className="control-room flex h-dvh overflow-hidden bg-background">
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      {sidebarOpen && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        aria-label="Workspace navigation"
        className={cn(
          "workspace-sidebar fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-border bg-sidebar transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "flex" : "hidden lg:flex",
          collapsed && "lg:hidden",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <Link
            to={homeRoute}
            className="flex items-center gap-2.5"
            onClick={() => setSidebarOpen(false)}
          >
            <img
              src={
                theme === "dark"
                  ? "/logo-logomark-white.svg"
                  : "/logo-logomark-black.svg"
              }
              alt=""
              className="h-8 w-8"
            />
            <div>
              <span className="block text-sm font-medium tracking-tight">
                angainor
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Control Room
              </span>
            </div>
          </Link>
          <button
            aria-label="Collapse navigation"
            className="workspace-icon-button hidden lg:inline-flex"
            onClick={() => setCollapsed(true)}
          >
            <PanelLeftClose size={15} />
          </button>
          <button
            aria-label="Close navigation"
            className="workspace-icon-button lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={17} />
          </button>
        </div>
        <div className="px-2 pb-3">
          <Link
            to={homeRoute}
            className="block rounded-md border border-border p-2.5"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="flex items-center gap-2 text-sm">
              <ArrowLeft size={14} className="text-primary" />
              Angainor
            </span>
            <span className="mt-1 block truncate text-[10px] tracking-wide text-muted-foreground">
              {isAdmin ? DEFAULT_FUND_CODE : "INVESTOR WORKSPACE"}
            </span>
          </Link>
          {isAdmin && (
            <div className="mt-3">
              <span className="mb-1.5 block text-xs text-muted-foreground">
                Current fund
              </span>
              <div
                className="truncate rounded-md border border-border bg-background px-2.5 py-2 text-xs"
                title={fundData?.fundName}
              >
                {fundData?.fundName || "Fund workspace"}
              </div>
            </div>
          )}
          <div className="mt-3 flex rounded-md border border-border p-0.5 text-xs">
            <span className="flex flex-1 items-center justify-center gap-2 rounded bg-muted py-1.5">
              <LayoutDashboard size={13} />
              Browse
            </span>
            <span
              className="flex-1"
              title="Fund Q&A is not connected in this MVP"
            >
              <button
                disabled
                className="flex w-full items-center justify-center gap-2 py-1.5 text-muted-foreground opacity-60"
              >
                <MessageSquare size={13} />
                Ask <span className="text-[9px]">Soon</span>
              </button>
            </span>
          </div>
        </div>
        <nav
          aria-label="Main navigation"
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
        >
          {Array.from(new Set(navItems.map((item) => item.group))).map(
            (group, index) => (
              <div key={group} className={index ? "mt-5" : ""}>
                {index > 0 && (
                  <p className="workspace-eyebrow mb-2 px-2">{group}</p>
                )}
                {navItems
                  .filter((item) => item.group === group)
                  .map((item) => {
                    const active =
                      location.pathname === item.path ||
                      (item.path !== "/investor" &&
                        location.pathname.startsWith(item.path + "/"));
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "workspace-nav-item",
                          active && "workspace-nav-active",
                        )}
                      >
                        <item.icon size={16} strokeWidth={1.6} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
              </div>
            ),
          )}
        </nav>
        <div className="border-t border-border px-2 py-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="workspace-nav-item w-full">
                <Bell size={16} />
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-auto rounded bg-primary/15 px-1.5 text-xs text-primary">
                    {unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-80 max-w-[90vw]"
            >
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recentNotifications.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No notifications yet
                </p>
              ) : (
                recentNotifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex flex-col items-start gap-1 py-2.5"
                    onClick={() => {
                      markAsRead(n.id);
                      navigate(n.targetRoute);
                      setSidebarOpen(false);
                    }}
                  >
                    <span className={cn("text-sm", !n.read && "font-medium")}>
                      {n.message}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(n.timestamp)}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  navigate("/notifications");
                  setSidebarOpen(false);
                }}
              >
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            to={profileRoute}
            className="workspace-nav-item"
            onClick={() => setSidebarOpen(false)}
          >
            <SlidersHorizontal size={16} />
            Settings
          </Link>
        </div>
        <div className="flex items-center justify-between border-t border-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account menu"
                className="flex min-w-0 items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2 text-xs"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px]">
                  {initials}
                </span>
                <span className="max-w-32 truncate">
                  {isAdmin ? "Angainor Admin" : "Investor"}
                </span>
                <ChevronDown size={12} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-60">
              <DropdownMenuLabel className="break-all text-xs">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(profileRoute)}>
                <User size={15} className="mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/help")}>
                <HelpCircle size={15} className="mr-2" />
                Help & Support
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut size={15} className="mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            className="workspace-icon-button"
            onClick={toggle}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4 lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Open navigation"
              aria-expanded={isCompact ? sidebarOpen : !collapsed}
              className={cn("workspace-icon-button", !collapsed && "lg:hidden")}
              onClick={() => {
                setSidebarOpen(true);
                setCollapsed(false);
              }}
            >
              <Menu size={18} />
            </button>
            <div className="truncate text-xs text-muted-foreground">
              <Link to={homeRoute} className="hover:text-foreground">
                {isAdmin ? "Portfolio" : "Investor"}
              </Link>
              <span className="mx-1.5 opacity-50">/</span>
              {isAdmin && fundData && (
                <>
                  <span className="hidden md:inline">
                    {fundData.fundName}
                    <span className="mx-1.5 opacity-50">/</span>
                  </span>
                </>
              )}
              <span className="text-foreground/80">{currentPage}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <WorkspaceSearch destinations={navItems} isAdmin={isAdmin} />
            {isAdmin && !DEMO_MODE && <ResetDemoButton />}
          </div>
        </header>
        {DEMO_MODE && (
          <div role="note" className="border-b border-border bg-primary/10 px-4 py-2 text-xs text-foreground lg:px-8">
            <strong>Demo workspace</strong> · Fictional records. Changes, uploads, and transactions are disabled.
          </div>
        )}
        <main
          id="workspace-main"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto p-4 outline-none sm:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function ResetDemoButton() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => resetDemoFund(DEFAULT_FUND_CODE).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setOpen(false);
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Reset demo data"
          aria-label="Reset demo data"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>all</strong> investors,
            subscriptions, settlements, ownership, transfers, distributions,
            capital calls, notices, documents, audit logs, and audit exports for
            this fund. The fund itself and the active waterfall config will be
            re-created from scratch. Login accounts (auth users) are preserved.
            <br />
            <br />
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <p className="text-sm text-destructive">
            {(mutation.error as Error).message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset demo"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
