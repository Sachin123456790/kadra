import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, FileText, Landmark, ArrowLeftRight,
  PieChart, Coins, Shield, Search, Bell, Settings, Menu, X,
  Sun, Moon, Monitor,
} from "lucide-react";
import { useTheme } from "./ThemeProvider";

const navItems = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Investors", path: "/investors", icon: Users },
  { label: "Subscriptions", path: "/subscriptions", icon: FileText },
  { label: "Settlement", path: "/settlement", icon: Landmark },
  { label: "Transfers", path: "/transfers", icon: ArrowLeftRight },
  { label: "Cap Table", path: "/cap-table", icon: PieChart },
  { label: "Distribution", path: "/distribution", icon: Coins },
  { label: "Audit & Exports", path: "/audit", icon: Shield },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="h-14 bg-topbar flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button className="lg:hidden text-topbar-foreground" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="text-lg font-bold text-topbar-foreground tracking-tight">Kadra</Link>
        </div>
        <div className="hidden sm:flex items-center bg-topbar-foreground/10 rounded-md px-3 py-1.5 w-72">
          <Search className="h-4 w-4 text-topbar-foreground/60 mr-2" />
          <input
            type="text"
            placeholder="Quick Search..."
            className="bg-transparent text-sm text-topbar-foreground placeholder:text-topbar-foreground/50 outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={cycleTheme}
            className="text-topbar-foreground/70 hover:text-topbar-foreground"
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="h-4.5 w-4.5" />
          </button>
          <button className="text-topbar-foreground/70 hover:text-topbar-foreground"><Bell className="h-4.5 w-4.5" /></button>
          <button className="text-topbar-foreground/70 hover:text-topbar-foreground"><Settings className="h-4.5 w-4.5" /></button>
          <div className="h-7 w-7 rounded-full bg-topbar-foreground/20 flex items-center justify-center text-xs font-medium text-topbar-foreground">K</div>
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
        </aside>

        {/* Overlay */}
        {sidebarOpen && <div className="fixed inset-0 bg-foreground/20 z-10 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
