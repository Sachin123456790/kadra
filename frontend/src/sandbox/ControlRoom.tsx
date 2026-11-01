import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  Clock3,
  Layers,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  Plus,
  Search,
  SlidersHorizontal,
  Sun,
  X,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTheme } from "@/components/angainor/ThemeProvider";
import { request } from "./api";
import { Login } from "./Login";
import { ErrorBox, Button } from "./ui";
import { Operations } from "./Operations";
import { Portfolio, FundDashboard } from "./Overview";
import { Onboarding } from "./Onboarding";
import { Ask } from "./Ask";
import { conversationItems, fundNavigation, fundUrl } from "./navigation";

export function ControlRoom() {
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [mobile, setMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const params = new URLSearchParams(location.search);
  const requested = params.get("fund") || selected;
  const path = location.pathname === "/" ? "/portfolio" : location.pathname;
  const isAsk = path === "/ask" || path === "/brain";
  const isSetup = path === "/funds/new";
  const isPortfolio = path === "/portfolio";
  const organizationView = isPortfolio || isSetup;
  const me = useQuery({
    queryKey: ["sandbox-session"],
    queryFn: () => request("/auth/me"),
  });
  const state = useQuery({
    queryKey: ["sandbox", me.data?.orgId, requested],
    queryFn: () =>
      request(
        `/state${requested ? "?fundId=" + encodeURIComponent(requested) : ""}`,
      ),
    enabled: !!me.data,
    refetchInterval: 5000,
  });
  const portfolio = useQuery({
    queryKey: ["sandbox", me.data?.orgId, "portfolio"],
    queryFn: () => request("/portfolio"),
    enabled: !!me.data,
    refetchInterval: 10000,
  });
  const mutation = useMutation({
    mutationFn: ({ path, body, method = "POST" }: any) =>
      request(path, method, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["sandbox"] });
    },
  });
  const act = (path: string, body: any = {}, method = "POST") =>
    mutation.mutateAsync({ path, body, method });
  useEffect(() => {
    if (state.data?.fund?.id) setSelected(state.data.fund.id);
  }, [state.data?.fund?.id]);
  useEffect(() => {
    setMobile(false);
    mutation.reset();
    setFilter("");
  }, [location.pathname, params.get("fund")]);
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  if (me.isPending)
    return <div className="p-8 text-sm">Loading your workspace…</div>;
  if (!me.data)
    return (me.error as any)?.status !== 401 ? (
      <div className="p-8 space-y-3">
        <ErrorBox error={me.error} />
        <Button onClick={() => me.refetch()}>Retry connection</Button>
      </div>
    ) : (
      <Login
        onLogin={() => {
          qc.clear();
          setSelected("");
          me.refetch();
        }}
      />
    );
  const data = state.data;
  const fundId = data?.fund?.id || "";
  const title = isPortfolio
    ? "Portfolio"
    : isSetup
      ? "Add new fund"
      : isAsk
        ? "Ask"
        : fundNavigation.find((n) => n.path === path)?.label ||
          {
            "/settings": "Settings",
            "/cap-table": "Capital accounts",
            "/subscriptions": "Subscriptions",
            "/admin/jobs": "Background jobs",
          }[path] ||
          "Workspace";
  const conversations = conversationItems(data);
  const go = (target: string) => {
    setSearchOpen(false);
    navigate(target);
  };
  const fundList = portfolio.data?.funds || data?.funds || [];
  const sideLink = (
    to: string,
    label: string,
    icon: React.ReactNode,
    active: boolean,
  ) => (
    <Link
      to={to}
      className={`workspace-nav-item ${active ? "workspace-nav-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
  return (
    <div className="control-room restored-control-room flex h-dvh overflow-hidden bg-background">
      <a
        href="#workspace-main"
        className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      {mobile && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        aria-label="Workspace navigation"
        className={`${mobile ? "flex" : collapsed ? "hidden" : "hidden lg:flex"} workspace-sidebar fixed inset-y-0 left-0 z-40 w-[236px] shrink-0 flex-col border-r border-border bg-sidebar lg:static`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-3">
          <Link to="/portfolio" className="flex items-center gap-2">
            <img
              src={
                theme === "dark"
                  ? "/logo-logomark-white.svg"
                  : "/logo-logomark-black.svg"
              }
              alt=""
              className="h-8 w-8"
            />
            <span className="text-xs">
              angainor
              <span className="block text-[11px] text-muted-foreground">
                Control Room
              </span>
            </span>
          </Link>
          <button
            aria-label="Collapse navigation"
            className="workspace-icon-button"
            onClick={() => {
              setCollapsed(true);
              setMobile(false);
            }}
          >
            <PanelLeftClose size={15} />
          </button>
        </div>
        {!organizationView && (
          <div className="px-2 pb-3">
            <Link
              to="/portfolio"
              className="block rounded-md border border-border px-3 py-2 text-xs"
            >
              <span className="flex items-center gap-2">
                <ArrowLeft size={13} className="text-primary" />
                Angainor
              </span>
              <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                {data?.fund?.name}
              </span>
            </Link>
            <label className="mt-3 block text-xs text-muted-foreground">
              Fund
              <select
                aria-label="Current fund"
                className="cr-input mt-1 w-full text-xs"
                value={fundId}
                onChange={(e) =>
                  navigate(fundUrl(isAsk ? "/ask" : path, e.target.value))
                }
              >
                {fundList.map((fund: any) => (
                  <option key={fund.id} value={fund.id}>
                    {fund.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="mx-2 mb-2 flex shrink-0 rounded-md border border-border p-0.5 text-xs">
          <Link
            to={organizationView ? "/portfolio" : fundUrl("/dashboard", fundId)}
            className={`cr-mode ${!isAsk ? "cr-mode-active" : ""}`}
          >
            <LayoutGrid size={13} />
            Browse
          </Link>
          <Link
            to={fundUrl("/ask", fundId)}
            className={`cr-mode ${isAsk ? "cr-mode-active" : ""}`}
          >
            <MessageSquare size={13} />
            Ask
          </Link>
        </div>
        <nav
          aria-label="Main navigation"
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
        >
          {organizationView ? (
            <>
              {sideLink(
                "/portfolio",
                "Portfolio",
                <LayoutGrid size={15} />,
                isPortfolio,
              )}
              <div className="flex items-center gap-2 px-2.5 py-2 text-xs">
                <Layers size={15} />
                Funds
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {fundList.length}
                </span>
                <ChevronDown size={12} />
              </div>
              <div className="relative mb-2">
                <Search
                  size={12}
                  className="absolute left-2 top-2.5 text-muted-foreground"
                />
                <input
                  className="cr-input w-full py-1.5 pl-7 text-[11px]"
                  aria-label="Find a fund"
                  placeholder="Find a fund"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              {fundList
                .filter((f: any) =>
                  f.name.toLowerCase().includes(filter.toLowerCase()),
                )
                .map((fund: any) => (
                  <Link
                    key={fund.id}
                    to={fundUrl("/dashboard", fund.id)}
                    className="cr-fund-link"
                  >
                    <span className="text-muted-foreground">⠿</span>
                    <span className="truncate">{fund.name}</span>
                    {fund.review_documents > 0 && (
                      <span className="cr-count">{fund.review_documents}</span>
                    )}
                  </Link>
                ))}
              {sideLink(
                "/funds/new",
                "Add new fund",
                <Plus size={14} />,
                isSetup,
              )}
              <details className="mt-3">
                <summary className="workspace-nav-item cursor-pointer">
                  <Clock3 size={15} />
                  Recents
                </summary>
                {(portfolio.data?.recent || []).slice(0, 5).map((a: any) => (
                  <Link
                    key={a.id}
                    className="cr-fund-link"
                    to={fundUrl("/ask", a.fund_id, {
                      conversation: a.conversation_id || a.id,
                    })}
                  >
                    <span className="truncate">{a.question}</span>
                  </Link>
                ))}
              </details>
            </>
          ) : isAsk ? (
            <>
              {sideLink(
                fundUrl("/ask", fundId),
                "New conversation",
                <Plus size={14} />,
                !params.get("conversation"),
              )}
              <div className="relative my-2">
                <Search
                  size={12}
                  className="absolute left-2 top-2.5 text-muted-foreground"
                />
                <input
                  className="cr-input w-full py-1.5 pl-7 text-[11px]"
                  aria-label="Find a conversation"
                  placeholder="Find a conversation"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <p className="workspace-eyebrow px-2 py-2">Chat history</p>
              {conversations
                .filter((c) =>
                  c.title.toLowerCase().includes(filter.toLowerCase()),
                )
                .map((c) => (
                  <Link
                    key={c.id}
                    title={c.title}
                    to={fundUrl("/ask", fundId, { conversation: c.id })}
                    className={`cr-fund-link ${params.get("conversation") === c.id ? "workspace-nav-active" : ""}`}
                  >
                    <span className="truncate">{c.title}</span>
                  </Link>
                ))}
              {!conversations.length && (
                <p className="px-2 text-xs leading-5 text-muted-foreground">
                  Your conversations will appear here.
                </p>
              )}
            </>
          ) : (
            fundNavigation.map((n) => (
              <div key={n.path}>
                {sideLink(
                  fundUrl(n.path, fundId),
                  n.label,
                  <n.icon size={15} />,
                  path === n.path,
                )}
              </div>
            ))
          )}
        </nav>
        <div className="shrink-0 border-t border-border px-2 py-2">
          {sideLink(
            fundUrl("/audit", fundId),
            "Notifications",
            <Bell size={15} />,
            false,
          )}
          {sideLink(
            fundUrl("/settings", fundId),
            "Settings",
            <SlidersHorizontal size={15} />,
            path === "/settings",
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-[10px]">
            {me.data.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[11px]" title={me.data.email}>
              {me.data.name}
            </span>
            <span className="text-[9px] text-muted-foreground">
              Private sandbox
            </span>
          </div>
          <button
            className="workspace-icon-button !h-6 !w-6"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <button
            className="workspace-icon-button !h-6 !w-6"
            aria-label="Log out"
            onClick={() =>
              request("/auth/logout", "POST").then(() => {
                qc.clear();
                setSelected("");
                me.refetch();
              })
            }
          >
            <LogOut size={13} />
          </button>
        </div>
      </aside>
      <div className="cr-workspace flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/50 px-4 lg:px-6">
          <button
            className={`workspace-icon-button ${collapsed ? "" : "lg:hidden"}`}
            aria-label="Open navigation"
            onClick={() => {
              setCollapsed(false);
              setMobile(true);
            }}
          >
            <Menu size={17} />
          </button>
          <div className="min-w-0 truncate text-[11px] text-muted-foreground">
            <Link to="/portfolio">Portfolio</Link>
            {!isPortfolio && (
              <>
                {" "}
                /{" "}
                {!organizationView && (
                  <>
                    <Link to={fundUrl("/dashboard", fundId)}>
                      {data?.fund?.name || "Fund"}
                    </Link>{" "}
                    /{" "}
                  </>
                )}
                {title}
              </>
            )}
          </div>
          <button
            className="workspace-search ml-auto shrink-0 bg-card/60"
            onClick={() => setSearchOpen(true)}
          >
            <Search size={13} />
            <span className="hidden sm:inline">Search knowledge base</span>
            <kbd className="hidden sm:inline">⌘K</kbd>
          </button>
        </header>
        <main
          id="workspace-main"
          className={`min-h-0 flex-1 ${isAsk || isSetup ? "flex flex-col overflow-hidden" : "overflow-y-auto p-4 lg:p-7"}`}
        >
          {(state.error || mutation.error) && (
            <div className="m-4 space-y-2">
              <ErrorBox error={state.error || mutation.error} />
              {state.error && (
                <Button
                  secondary
                  onClick={() => {
                    setSelected("");
                    navigate("/portfolio");
                    state.refetch();
                  }}
                >
                  Return to active portfolio
                </Button>
              )}
            </div>
          )}
          {isPortfolio ? (
            <Portfolio
              data={portfolio.data}
              error={portfolio.error}
              loading={portfolio.isPending}
              retry={() => portfolio.refetch()}
            />
          ) : isSetup ? (
            <Onboarding
              key={params.get("fund") || "new"}
              data={params.get("fund") ? data : undefined}
              actor={me.data}
              act={act}
              pending={mutation.isPending}
            />
          ) : data ? (
            isAsk ? (
              <Ask key={fundId} data={data} />
            ) : path === "/dashboard" ? (
              <FundDashboard data={data} />
            ) : (
              <div className="mx-auto max-w-[1600px] space-y-5">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {data.fund.name}
                  </p>
                  <h1 className="text-xl font-medium tracking-tight">
                    {title}
                  </h1>
                </div>
                <Operations
                  key={fundId + path}
                  path={path}
                  data={data}
                  f={`/funds/${fundId}`}
                  act={act}
                  pending={mutation.isPending}
                  onReset={(r: any) => {
                    setSelected(r.fundId);
                    qc.invalidateQueries();
                    navigate("/portfolio");
                  }}
                />
              </div>
            )
          ) : (
            !state.error && (
              <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={15} />
                Loading fund records…
              </div>
            )
          )}
        </main>
      </div>
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-xl">
          <DialogTitle>Search knowledge base</DialogTitle>
          <DialogDescription>
            Find a fund, workspace, or document in the current fund.
          </DialogDescription>
          <input
            autoFocus
            className="cr-input"
            aria-label="Search knowledge base"
            placeholder="Search funds, documents, workflows…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-80 overflow-auto space-y-1">
            {fundList
              .filter((f: any) =>
                f.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((f: any) => (
                <button
                  key={f.id}
                  className="workspace-result"
                  onClick={() => go(fundUrl("/dashboard", f.id))}
                >
                  <Layers size={15} />
                  {f.name}
                  <span className="ml-auto text-xs text-muted-foreground">
                    Fund
                  </span>
                </button>
              ))}
            {fundNavigation
              .filter((n) =>
                n.label.toLowerCase().includes(search.toLowerCase()),
              )
              .map((n) => (
                <button
                  key={n.path}
                  className="workspace-result"
                  onClick={() => go(fundUrl(n.path, fundId))}
                >
                  <n.icon size={15} />
                  {n.label}
                </button>
              ))}
            {(data?.documents || [])
              .filter((d: any) =>
                d.filename.toLowerCase().includes(search.toLowerCase()),
              )
              .map((d: any) => (
                <button
                  key={d.id}
                  className="workspace-result"
                  onClick={() => go(fundUrl("/documents", fundId))}
                >
                  {d.filename}
                  <span className="ml-auto text-xs text-muted-foreground">
                    v{d.version}
                  </span>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
