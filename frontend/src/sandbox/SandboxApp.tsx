import { useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "@/components/angainor/ThemeProvider";
import { adminWorkspaceNavigation } from "@/components/angainor/workspace-navigation";
import {
  MessageSquare,
  Building2,
  Wallet,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Loader2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { base, request, currency, today, download } from "./api";

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Input(props: any) {
  return <input {...props} className={inputClass} />;
}
function Select(props: any) {
  return <select {...props} className={inputClass} />;
}
function Button({ children, secondary = false, ...props }: any) {
  return (
    <button
      {...props}
      className={`${secondary ? "border border-border bg-card hover:bg-muted" : "bg-primary text-primary-foreground hover:bg-primary/90"} inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
function Panel({
  children,
  title,
  action,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
function Badge({ children }: any) {
  return (
    <span className="inline-block rounded border border-border bg-muted/40 px-2 py-0.5 text-[10px]">
      {children}
    </span>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap border-b border-border p-3 font-medium text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td
                    key={j}
                    className="border-b border-border/60 p-3 align-top"
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={headers.length}
                className="p-6 text-center text-muted-foreground"
              >
                No records yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function ErrorBox({ error }: any) {
  return error ? (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
    >
      {error.message || String(error)}
    </div>
  ) : null;
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    inviteCode: "",
  });
  const mutation = useMutation({
    mutationFn: () =>
      request(`/auth/${register ? "register" : "login"}`, "POST", form),
    onSuccess: onLogin,
  });
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-7 rounded-xl border border-border bg-card p-8">
        <img
          src="/logo-combomark-white.svg"
          className="hidden h-7 dark:block"
          alt="Angainor"
        />
        <img
          src="/logo-combomark-black.svg"
          className="h-7 dark:hidden"
          alt="Angainor"
        />
        <div>
          <p className="workspace-eyebrow mb-2">
            Control Room · Private sandbox
          </p>
          <h1 className="text-2xl font-semibold">
            {register ? "Create your sandbox" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your own persistent workspace, with fictional seed data and private
            document uploads.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {(register
            ? ["name", "email", "password", "inviteCode"]
            : ["email", "password"]
          ).map((key) => (
            <Field
              key={key}
              label={
                {
                  name: "Your name",
                  email: "Email",
                  password: "Password",
                  inviteCode: "Invitation code",
                }[key]
              }
            >
              <Input
                required
                type={
                  key === "password"
                    ? "password"
                    : key === "email"
                      ? "email"
                      : "text"
                }
                autoComplete={
                  key === "password"
                    ? register
                      ? "new-password"
                      : "current-password"
                    : key === "email"
                      ? "email"
                      : "off"
                }
                minLength={key === "password" && register ? 12 : undefined}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </Field>
          ))}
          <ErrorBox error={mutation.error} />
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {register ? "Create private sandbox" : "Sign in"}
          </Button>
        </form>
        <button
          className="text-xs text-primary"
          onClick={() => {
            setRegister(!register);
            mutation.reset();
          }}
        >
          {register
            ? "Already have an account? Sign in"
            : "Have an invitation? Create a sandbox"}
        </button>
      </div>
    </div>
  );
}
function Workspace() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const [mobile, setMobile] = useState(false);
  const me = useQuery({
    queryKey: ["sandbox-session"],
    queryFn: () => request("/auth/me"),
  });
  const [selected, setSelected] = useState("");
  const [fundName, setFundName] = useState("");
  const [showFund, setShowFund] = useState(false);
  const state = useQuery({
    queryKey: ["sandbox", me.data?.orgId, selected],
    queryFn: () =>
      request(
        `/state${selected ? "?fundId=" + encodeURIComponent(selected) : ""}`,
      ),
    enabled: !!me.data,
    refetchInterval: 5000,
  });
  const mutation = useMutation({
    mutationFn: ({ path, body, method = "POST" }: any) =>
      request(path, method, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sandbox"] }),
  });
  async function act(path: string, body: any = {}, method = "POST") {
    return mutation.mutateAsync({ path, body, method });
  }
  const changeFund = (value: string) => {
    setSelected(value);
    mutation.reset();
  };
  if (me.isPending)
    return <div className="p-8 text-sm">Loading your workspace…</div>;
  if (!me.data)
    return (
      <Login
        onLogin={() => {
          qc.clear();
          setSelected("");
          me.refetch();
        }}
      />
    );
  const data = state.data;
  const fundId = data?.fund?.id;
  const f = `/funds/${fundId}`;
  const nav = [
    ...adminWorkspaceNavigation.filter((n) => n.path !== "/transfers"),
    {
      label: "Fund Brain",
      path: "/brain",
      icon: MessageSquare,
      group: "Fund workspace",
    },
    {
      label: "SPVs & Properties",
      path: "/properties",
      icon: Building2,
      group: "Operations",
    },
    {
      label: "Financial Records",
      path: "/financial",
      icon: Wallet,
      group: "Operations",
    },
  ];
  const path = location.pathname === "/" ? "/dashboard" : location.pathname;
  const title = nav.find((n) => n.path === path)?.label || "Settings";
  return (
    <div className="control-room flex h-dvh overflow-hidden bg-background">
      {mobile && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`${mobile ? "flex" : "hidden lg:flex"} workspace-sidebar fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:static`}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img
              alt=""
              src={
                theme === "dark"
                  ? "/logo-logomark-white.svg"
                  : "/logo-logomark-black.svg"
              }
              className="h-8 w-8"
            />
            <div>
              <span className="text-sm">angainor</span>
              <span className="block text-[11px] text-muted-foreground">
                Control Room
              </span>
            </div>
          </Link>
          <button
            className="lg:hidden"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 px-3 pb-4">
          <p className="text-xs text-muted-foreground">
            {me.data.name}’s sandbox
          </p>
          <Field label="Current fund">
            <Select
              aria-label="Current fund"
              value={fundId || ""}
              onChange={(e) => changeFund(e.target.value)}
            >
              {data?.funds?.map((fund) => (
                <option value={fund.id} key={fund.id}>
                  {fund.name}
                </option>
              ))}
            </Select>
          </Field>
          <button
            className="flex items-center gap-1 text-xs text-primary"
            onClick={() => setShowFund(!showFund)}
          >
            <Plus size={13} /> Add fund
          </button>
          {showFund && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                act("/funds", { name: fundName, currency: "USD" })
                  .then((r) => {
                    changeFund(r.id);
                    setShowFund(false);
                    setFundName("");
                  })
                  .catch(() => {});
              }}
            >
              <Input
                aria-label="New fund name"
                required
                placeholder="Fund name"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
              />
              <Button disabled={mutation.isPending}>Create fund</Button>
            </form>
          )}
          <Link
            to="/brain"
            onClick={() => setMobile(false)}
            className="flex items-center justify-center gap-2 rounded-md border border-border py-2 text-xs"
          >
            <MessageSquare size={14} /> Ask Fund Brain
          </Link>
        </div>
        <nav
          aria-label="Main navigation"
          className="min-h-0 flex-1 overflow-y-auto px-2"
        >
          {nav.map((n) => (
            <Link
              key={n.path}
              to={n.path}
              onClick={() => {
                setMobile(false);
                mutation.reset();
              }}
              className={`workspace-nav-item ${path === n.path ? "workspace-nav-active" : ""}`}
              aria-current={path === n.path ? "page" : undefined}
            >
              <n.icon size={16} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-border p-3">
          <Link className="workspace-nav-item" to="/settings">
            <RotateCcw size={15} /> Settings & reset
          </Link>
          <div className="flex items-center justify-between">
            <span
              className="truncate text-[11px] text-muted-foreground"
              title={me.data.email}
            >
              {me.data.email}
            </span>
            <button onClick={toggle} aria-label="Toggle theme">
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              aria-label="Log out"
              onClick={() =>
                request("/auth/logout", "POST").then(() => {
                  qc.clear();
                  setSelected("");
                  me.refetch();
                })
              }
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
          <button
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={18} />
          </button>
          <span className="truncate text-xs text-muted-foreground">
            Portfolio / {data?.fund?.name || "Workspace"} /{" "}
            <span className="text-foreground">{title}</span>
          </span>
          {state.isFetching && (
            <Loader2 size={13} className="ml-auto animate-spin" />
          )}
        </header>
        <div className="border-b border-border bg-primary/10 px-5 py-2 text-xs">
          <strong>Private sandbox</strong> ·{" "}
          {data?.fund?.synthetic ? "Fictional baseline." : "User-created fund."}{" "}
          Changes persist. No payments or notice delivery.
        </div>
        <main className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div>
            <p className="workspace-eyebrow mb-2">Fund workspace</p>
            <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
          </div>
          <ErrorBox error={state.error || mutation.error} />
          {state.error && (
            <Button
              secondary
              onClick={() => {
                setSelected("");
                state.refetch();
              }}
            >
              Reload active sandbox
            </Button>
          )}
          {data && (
            <Pages
              key={fundId + path}
              path={path}
              data={data}
              f={f}
              act={act}
              pending={mutation.isPending}
              onReset={(r) => {
                setSelected(r.fundId);
                qc.invalidateQueries();
              }}
            />
          )}
          {!data && !state.error && (
            <p className="text-sm text-muted-foreground">
              Loading fund records…
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
function Pages({ path, data, f, act, pending, onReset }: any) {
  if (path === "/dashboard") return <Dashboard data={data} />;
  if (path === "/investors" || path === "/subscriptions")
    return (
      <Records kind="investor" data={data} f={f} act={act} pending={pending} />
    );
  if (path === "/properties")
    return (
      <div className="space-y-5">
        <Records kind="spv" data={data} f={f} act={act} pending={pending} />
        <Records
          kind="property"
          data={data}
          f={f}
          act={act}
          pending={pending}
        />
      </div>
    );
  if (path === "/financial")
    return (
      <Records kind="financial" data={data} f={f} act={act} pending={pending} />
    );
  if (path === "/documents")
    return <Documents data={data} f={f} act={act} pending={pending} />;
  if (path === "/waterfall")
    return <Rules data={data} f={f} act={act} pending={pending} />;
  if (path === "/brain")
    return <Brain data={data} f={f} act={act} pending={pending} />;
  if (path === "/settlement")
    return <Calls data={data} f={f} act={act} pending={pending} />;
  if (path === "/distribution")
    return <Scenarios data={data} f={f} act={act} pending={pending} />;
  if (path === "/cap-table") return <Report data={data} f={f} />;
  if (path === "/audit" || path === "/admin/jobs")
    return <Audit data={data} f={f} act={act} pending={pending} />;
  return <Settings data={data} act={act} pending={pending} onReset={onReset} />;
}
function Dashboard({ data }: any) {
  const investors = data.records.filter((r) => r.kind === "investor");
  const stats = [
    ["Commitments", currency(data.totals?.commitments)],
    ["Recorded contributions", currency(data.totals?.contributions)],
    ["Investors", investors.length],
    [
      "Documents needing attention",
      data.documents.filter((d) => d.status !== "READY").length,
    ],
  ];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-5"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-3 text-2xl font-medium">{value}</p>
          </div>
        ))}
      </div>
      <Panel title="Fund operations">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              "/documents",
              "Build the Fund Brain",
              "Upload documents, review evidence and confirm governing terms.",
            ],
            [
              "/settlement",
              "Prepare a capital call",
              "Calculate allocations, verify exceptions, approve and export drafts.",
            ],
            [
              "/brain",
              "Ask a fund question",
              "Find cited source passages and identify missing evidence.",
            ],
          ].map(([path, title, description]) => (
            <Link
              key={path}
              to={path}
              className="rounded-lg border border-border p-4 hover:bg-muted/40"
            >
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </Panel>
      <Panel title="Current capabilities">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Document processing: {data.capabilities.ocr}</p>
          <p>Term extraction: {data.capabilities.extraction}</p>
          <p>Fund Brain: {data.capabilities.answers}</p>
          <p>
            Rulebook version {data.rulebook.version} · Sandbox generation{" "}
            {data.generation}
          </p>
        </div>
      </Panel>
    </>
  );
}
const blanks: any = {
  investor: { name: "", email: "", commitment: "", status: "ACTIVE" },
  spv: { name: "", jurisdiction: "" },
  property: { name: "", address: "", spvId: "", ownership: "1" },
  financial: {
    category: "CONTRIBUTION",
    amount: "",
    date: "",
    currency: "USD",
    reference: "",
    investorId: "",
    callId: "",
    propertyId: "",
  },
};
function Records({ kind, data, f, act, pending }: any) {
  const [form, setForm] = useState<any>({
    ...blanks[kind],
    ...(kind === "financial" ? { date: today() } : {}),
  });
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const records = data.records.filter((r) => r.kind === kind);
  const options = (field: string) =>
    field === "status"
      ? ["ACTIVE", "INACTIVE"].map((v) => ({ id: v, label: v }))
      : field === "category"
        ? [
            "CONTRIBUTION",
            "INCOME",
            "EXPENSE",
            "VALUATION",
            "DISTRIBUTION",
          ].map((v) => ({ id: v, label: v }))
        : field === "callId"
          ? data.calls
              .filter((c) => c.status === "APPROVED")
              .map((c) => ({ id: c.id, label: `Call ${c.number}` }))
          : data.records
              .filter(
                (r) =>
                  r.kind ===
                  {
                    investorId: "investor",
                    spvId: "spv",
                    propertyId: "property",
                  }[field],
              )
              .map((r) => ({ id: r.id, label: r.data.name }));
  const submit = async (e: any) => {
    e.preventDefault();
    const cleaned = Object.fromEntries(
      Object.entries(form).filter(
        ([k, v]) =>
          !["investorId", "callId", "propertyId"].includes(k) || v !== "",
      ),
    );
    try {
      await act(
        `${f}/records/${kind}${editing ? "/" + editing.id : ""}`,
        { data: cleaned, revision: editing?.revision },
        editing ? "PUT" : "POST",
      );
      setOpen(false);
      setEditing(null);
      setForm({
        ...blanks[kind],
        ...(kind === "financial" ? { date: today() } : {}),
      });
    } catch {}
  };
  return (
    <Panel
      title={
        {
          investor: "Investors & commitments",
          spv: "SPVs",
          property: "Properties",
          financial: "Financial records",
        }[kind]
      }
      action={
        <Button secondary onClick={() => setOpen(!open)}>
          <Plus size={14} />
          Add {kind}
        </Button>
      }
    >
      {open && (
        <form
          onSubmit={submit}
          className="mb-5 grid gap-4 rounded-md bg-muted/20 p-4 sm:grid-cols-2"
        >
          {Object.keys(blanks[kind])
            .filter((k) => k !== "currency")
            .map((field) => (
              <Field key={field} label={field.replace(/([A-Z])/g, " $1")}>
                {[
                  "status",
                  "category",
                  "investorId",
                  "callId",
                  "spvId",
                  "propertyId",
                ].includes(field) ? (
                  <Select
                    value={form[field]}
                    onChange={(e) =>
                      setForm({ ...form, [field]: e.target.value })
                    }
                    required={field === "spvId"}
                  >
                    <option value="">Select or leave blank</option>
                    {options(field).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    type={
                      field === "date"
                        ? "date"
                        : field === "email"
                          ? "email"
                          : "text"
                    }
                    required={field !== "email" && field !== "jurisdiction"}
                    value={form[field]}
                    onChange={(e) =>
                      setForm({ ...form, [field]: e.target.value })
                    }
                  />
                )}
              </Field>
            ))}
          <div className="flex items-end gap-2">
            <Button disabled={pending}>Save {kind}</Button>
            <Button
              type="button"
              secondary
              onClick={() => {
                setOpen(false);
                setEditing(null);
                setForm({
                  ...blanks[kind],
                  ...(kind === "financial" ? { date: today() } : {}),
                });
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {kind === "financial" && (
        <div className="mb-4 max-w-lg">
          <Field label="Reason for reversing a posted record">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the correction before clicking Reverse"
            />
          </Field>
        </div>
      )}
      <Table
        headers={
          kind === "financial"
            ? ["Date", "Type", "Amount", "Reference", "Action"]
            : ["Name", "Details", "Action"]
        }
        rows={records.map((r) =>
          kind === "financial"
            ? [
                r.data.date,
                <Badge>{r.data.reverses ? "REVERSAL" : r.data.category}</Badge>,
                currency(r.amount),
                r.data.reference,
                !r.data.reverses &&
                !records.some((s) => s.data.reverses === r.id) ? (
                  <Button
                    secondary
                    disabled={pending || !reason.trim()}
                    onClick={() =>
                      act(`${f}/records/${r.id}/reverse`, { reason }).catch(
                        () => {},
                      )
                    }
                  >
                    Reverse
                  </Button>
                ) : null,
              ]
            : [
                r.data.name,
                kind === "investor"
                  ? currency(r.amount)
                  : kind === "property"
                    ? `${r.data.address} · ${Number(r.data.ownership) * 100}% ownership`
                    : r.data.jurisdiction,
                <Button
                  secondary
                  onClick={() => {
                    setForm(
                      Object.fromEntries(
                        Object.keys(blanks[kind]).map((k) => [
                          k,
                          r.data[k] ?? blanks[kind][k],
                        ]),
                      ),
                    );
                    setEditing(r);
                    setOpen(true);
                  }}
                >
                  Edit
                </Button>,
              ],
        )}
      />
    </Panel>
  );
}
function SourceLink({ fundId, source }: any) {
  return (
    <a
      className="text-primary underline underline-offset-4"
      href={`${base}/funds/${fundId}/documents/${source.documentId || source.document_id}/content${source.locator?.page ? "#page=" + source.locator.page : ""}`}
      target="_blank"
      rel="noreferrer"
    >
      {source.filename || "Source document"} · v{source.version || 1} ·{" "}
      {source.locator?.page
        ? `${source.locator.rendition ? "rendition " : ""}page ${source.locator.page}`
        : `${source.locator?.sheet || ""} ${source.locator?.cells || ""}`}
    </a>
  );
}
function Documents({ data, f, act, pending }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("lpa");
  const [effective, setEffective] = useState("");
  const [replaces, setReplaces] = useState("");
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const sources = useQuery({
    queryKey: ["sandbox", data.fund.id, "sources", selected],
    queryFn: () => request(`${f}/sources?documentId=${selected}`),
    enabled: !!selected,
  });
  const submit = async (e: any) => {
    e.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.append("documentType", type);
    if (effective) form.append("effectiveDate", effective);
    if (replaces) form.append("replaces", replaces);
    form.append("file", file);
    try {
      await act(`${f}/documents`, form);
      setFile(null);
      e.target.reset();
    } catch {}
  };
  return (
    <>
      <Panel title="Upload documents">
        <form
          onSubmit={submit}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Field label="PDF, scanned PDF, DOCX, XLSX or CSV">
            <Input
              type="file"
              required
              accept=".pdf,.docx,.xlsx,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </Field>
          <Field label="Document type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {[
                "lpa",
                "amendment",
                "side_letter",
                "subscription_agreement",
                "financial_statement",
                "spreadsheet",
                "other",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Effective date, if stated">
            <Input
              type="date"
              value={effective}
              onChange={(e) => setEffective(e.target.value)}
            />
          </Field>
          <Field label="New version of">
            <Select
              value={replaces}
              onChange={(e) => setReplaces(e.target.value)}
            >
              <option value="">New document</option>
              {data.documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename} v{d.version}
                </option>
              ))}
            </Select>
          </Field>
          <Button disabled={!file || pending}>
            {pending ? "Uploading…" : "Upload privately"}
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          10 MB per file, 80 PDF pages. OCR runs locally in English. Spreadsheet
          formulas are not recalculated.
        </p>
      </Panel>
      <Panel title="Fund documents">
        <Table
          headers={["Document", "Version", "Processing", "Action"]}
          rows={data.documents.map((d) => [
            <div>
              <p>{d.filename}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {d.synthetic ? "Synthetic fixture" : d.document_type}
              </p>
            </div>,
            d.version,
            <div>
              <Badge>{d.status}</Badge>
              {d.error && (
                <p className="mt-2 max-w-sm text-destructive">{d.error}</p>
              )}
            </div>,
            <div className="flex flex-wrap gap-2">
              <Button secondary onClick={() => setSelected(d.id)}>
                Review sources
              </Button>
              <a
                className="text-primary"
                href={`${base}${f}/documents/${d.id}/content`}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            </div>,
          ])}
        />
      </Panel>
      {selected && (
        <Panel
          title="Source room"
          action={
            <Button secondary onClick={() => setSelected("")}>
              Close
            </Button>
          }
        >
          <ErrorBox error={sources.error} />
          {sources.isPending ? (
            <p>Loading passages…</p>
          ) : (
            <div className="max-h-96 space-y-4 overflow-auto">
              {sources.data?.map((s) => (
                <div key={s.id} className="rounded-md border border-border p-3">
                  <p className="mb-2 text-xs">
                    <SourceLink fundId={data.fund.id} source={s} />
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-6">
                    {s.text}
                  </pre>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {s.locator.method}
                    {s.locator.requiresReview
                      ? " · OCR requires visual review"
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 space-y-3">
            <Link to="/waterfall" className="text-xs text-primary">
              Confirm interpretations in Waterfall Terms →
            </Link>
            {data.documents.find((d) => d.id === selected)?.status ===
              "NEEDS_REVIEW" && (
              <>
                <Field label="Review decision: explain treatment of this document and any rejected suggestions">
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <Button
                  disabled={!reason.trim() || pending}
                  onClick={() =>
                    act(`${f}/documents/${selected}/review`, { reason })
                      .then(() => setSelected(""))
                      .catch(() => {})
                  }
                >
                  Complete review and reject unaccepted suggestions
                </Button>
              </>
            )}
          </div>
        </Panel>
      )}
    </>
  );
}
function Rules({ data, f, act, pending }: any) {
  const [validationError, setValidationError] = useState("");
  const sources = useQuery({
    queryKey: ["sandbox", data.fund.id, "all-sources"],
    queryFn: () => request(`${f}/sources`),
  });
  const [form, setForm] = useState({
    key: "capital_calls.allocation_basis",
    value: "commitment",
    sourceId: "",
    investorId: "",
    effectiveFrom: today(),
    reason: "",
    replaceConfirmed: false,
    factId: "",
  });
  const submit = async (e: any) => {
    e.preventDefault();
    setValidationError("");
    let value: any = form.value;
    try {
      if (data.taxonomy[form.key] !== "text") value = JSON.parse(form.value);
    } catch {
      setValidationError("Use a JSON number or array for this term.");
      return;
    }
    await act(`${f}/rules`, {
      ...form,
      value,
      sourceId: form.sourceId,
      investorId: form.investorId || undefined,
      factId: form.factId || undefined,
      baseVersion: data.rulebook.version,
    }).catch(() => {});
  };
  return (
    <>
      <Panel title={`Published rulebook · version ${data.rulebook.version}`}>
        <p className="mb-4 text-xs text-muted-foreground">
          Reviewed interpretations govern calculations. New versions preserve
          prior decisions and outputs.
        </p>
        <Table
          headers={["Term", "Value", "Scope", "Effective", "Evidence"]}
          rows={data.rulebook.rules.map((r) => [
            r.key,
            JSON.stringify(r.value),
            data.records.find((i) => i.id === r.investorId)?.data.name ||
              "Fund",
            r.effectiveFrom,
            <span className="text-[10px]">
              {sources.data?.find((s) => s.id === r.sourceId) ? (
                <SourceLink
                  fundId={data.fund.id}
                  source={sources.data.find((s) => s.id === r.sourceId)}
                />
              ) : (
                r.sourceId
              )}
            </span>,
          ])}
        />
      </Panel>
      <Panel title="Confirm an interpretation">
        <ErrorBox error={validationError} />
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Taxonomy term">
            <Select
              value={form.key}
              onChange={(e) =>
                setForm({ ...form, key: e.target.value, factId: "" })
              }
            >
              {Object.keys(data.taxonomy).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Select>
          </Field>
          <Field label={`Value (${data.taxonomy[form.key]}; arrays use JSON)`}>
            <Input
              required
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </Field>
          <Field label="Supporting passage">
            <Select
              required
              value={form.sourceId}
              onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
            >
              <option value="">Select evidence</option>
              {sources.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.filename}: {s.text.slice(0, 120)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Investor scope">
            <Select
              value={form.investorId}
              onChange={(e) => setForm({ ...form, investorId: e.target.value })}
            >
              <option value="">Entire fund</option>
              {data.records
                .filter((r) => r.kind === "investor")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.data.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Effective from">
            <Input
              required
              type="date"
              value={form.effectiveFrom}
              onChange={(e) =>
                setForm({ ...form, effectiveFrom: e.target.value })
              }
            />
          </Field>
          <Field label="Reason and precedence decision">
            <Input
              required
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.replaceConfirmed}
              onChange={(e) =>
                setForm({ ...form, replaceConfirmed: e.target.checked })
              }
            />
            Replace an interpretation with the same scope and effective date
          </label>
          <Button disabled={pending || !form.sourceId}>
            Publish reviewed interpretation
          </Button>
        </form>
      </Panel>
      <Panel title="Unreviewed extraction suggestions">
        <Table
          headers={["Term", "Suggested value", "Action"]}
          rows={data.facts
            .filter((f) => f.state === "UNREVIEWED")
            .map((fact) => [
              fact.taxonomy_key,
              JSON.stringify(fact.value),
              <Button
                secondary
                onClick={() =>
                  setForm({
                    ...form,
                    key: fact.taxonomy_key,
                    value:
                      typeof fact.value === "string"
                        ? fact.value
                        : JSON.stringify(fact.value),
                    sourceId: fact.source_id,
                    factId: fact.id,
                  })
                }
              >
                Review
              </Button>,
            ])}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          {data.facts.filter((f) => f.state === "NOT_EXTRACTED").length} fields
          were not extracted. This does not prove the provisions are absent;
          review the source documents.
        </p>
      </Panel>
    </>
  );
}
function Brain({ data, f, act, pending }: any) {
  const [question, setQuestion] = useState("");
  const [asOf, setAsOf] = useState(today());
  return (
    <>
      <Panel title="Ask Fund Brain">
        <p className="mb-4 text-xs text-muted-foreground">
          {data.capabilities.answers}. Financial workflow calculations remain
          deterministic.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(`${f}/questions`, { question, asOf })
              .then(() => setQuestion(""))
              .catch(() => {});
          }}
          className="space-y-3"
        >
          <textarea
            required
            aria-label="Fund question"
            className={inputClass}
            rows={3}
            placeholder="What are the capital call notice requirements?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="flex items-end gap-3">
            <Field label="As of">
              <Input
                type="date"
                required
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
              />
            </Field>
            <Button disabled={pending}>Ask question</Button>
          </div>
        </form>
      </Panel>
      {data.answers.map((entry) => (
        <Panel key={entry.id} title={entry.question}>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge>{entry.answer.status}</Badge>
            <Badge>{entry.answer.mode}</Badge>
            <Badge>As of {entry.answer.asOf}</Badge>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6">
            {entry.answer.text}
          </p>
          {entry.answer.notice && (
            <p className="mt-2 text-xs text-muted-foreground">
              {entry.answer.notice}
            </p>
          )}
          {entry.answer.requiresReview && (
            <p className="mt-3 text-xs text-muted-foreground">
              AI draft. Source links are validated; the interpretation still
              needs human review.
            </p>
          )}
          {entry.answer.calculation && (
            <details className="mt-4 rounded-md border border-border p-3 text-xs">
              <summary>View calculation and source records</summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(entry.answer.calculation, null, 2)}
              </pre>
            </details>
          )}
          <div className="mt-4 space-y-3">
            {entry.answer.citations.map((s) => (
              <div
                key={s.id}
                className="rounded-md border border-border p-3 text-xs"
              >
                <SourceLink fundId={data.fund.id} source={s} />
                <blockquote className="mt-2 whitespace-pre-wrap leading-5 text-muted-foreground">
                  {s.quote}
                </blockquote>
                <p className="mt-2">
                  {s.interpretations.length
                    ? "Has reviewed interpretation for this date"
                    : "Source passage only. Applicability and precedence need review."}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </>
  );
}
function Calls({ data, f, act, pending }: any) {
  const [editing, setEditing] = useState<any>(null);
  const [changeReason, setChangeReason] = useState("");
  const [form, setForm] = useState({
    amount: "1000000.00",
    purpose: "operating",
    asOf: today(),
    dueDate: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
  });
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const call = data.calls.find((c) => c.id === selected) || data.calls[0];
  const run = data.runs.find(
    (r) => r.call_id === call?.id && r.status !== "SUPERSEDED",
  );
  return (
    <>
      <Panel
        title={
          editing ? `Revise call ${editing.number}` : "Draft a capital call"
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act(
              `${f}/calls${editing ? "/" + editing.id : ""}`,
              {
                ...form,
                ...(editing
                  ? { revision: editing.revision, reason: changeReason }
                  : {}),
              },
              editing ? "PUT" : "POST",
            )
              .then((r) => {
                setSelected(r.id);
                setEditing(null);
                setChangeReason("");
              })
              .catch(() => {});
          }}
          className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          {Object.keys(form).map((k) => (
            <Field
              key={k}
              label={
                {
                  amount: "Amount (USD)",
                  purpose: "Purpose code",
                  asOf: "Calculation date",
                  dueDate: "Due date",
                }[k]
              }
            >
              <Input
                required
                value={form[k]}
                type={k === "asOf" || k === "dueDate" ? "date" : "text"}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </Field>
          ))}
          {editing && (
            <Field label="Reason for revision">
              <Input
                required
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
              />
            </Field>
          )}
          <Button disabled={pending}>
            {editing ? "Save revised draft" : "Create draft"}
          </Button>
          {editing && (
            <Button secondary type="button" onClick={() => setEditing(null)}>
              Stop editing
            </Button>
          )}
        </form>
      </Panel>
      <Panel title="Capital calls">
        <Table
          headers={["Call", "Amount", "Purpose", "Due", "Status", "Action"]}
          rows={data.calls.map((c) => [
            c.number,
            currency(c.amount),
            c.purpose,
            String(c.due_date).slice(0, 10),
            <Badge>{c.status}</Badge>,
            <Button secondary onClick={() => setSelected(c.id)}>
              Open
            </Button>,
          ])}
        />
      </Panel>
      {call && (
        <Panel
          title={`Call ${call.number} · review allocations`}
          action={
            <Button
              disabled={
                pending || ["APPROVED", "CANCELLED"].includes(call.status)
              }
              onClick={() =>
                act(`${f}/calls/${call.id}/calculate`, {
                  revision: call.revision,
                }).catch(() => {})
              }
            >
              Calculate and verify
            </Button>
          }
        >
          {!["APPROVED", "CANCELLED"].includes(call.status) && (
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <Button
                secondary
                onClick={() => {
                  setEditing(call);
                  setForm({
                    amount: call.amount,
                    purpose: call.purpose,
                    asOf: String(call.as_of).slice(0, 10),
                    dueDate: String(call.due_date).slice(0, 10),
                  });
                }}
              >
                Edit draft above
              </Button>
              <Field label="Cancellation reason">
                <Input
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                />
              </Field>
              <Button
                secondary
                disabled={pending || !changeReason.trim()}
                onClick={() =>
                  act(
                    `${f}/calls/${call.id}`,
                    {
                      cancel: true,
                      revision: call.revision,
                      reason: changeReason,
                    },
                    "PUT",
                  )
                    .then(() => setEditing(null))
                    .catch(() => {})
                }
              >
                Cancel call
              </Button>
            </div>
          )}
          {!run ? (
            <p className="text-sm text-muted-foreground">
              Calculate to select the applicable rules, check investor
              exceptions and review allocations.
            </p>
          ) : (
            <>
              <Badge>{run.status}</Badge>
              <Table
                headers={[
                  "Investor",
                  "Commitment",
                  "Funded",
                  "Reserved elsewhere",
                  "Available",
                  "Call allocation",
                ]}
                rows={run.result.allocations.map((a) => [
                  a.name,
                  currency(a.commitment),
                  currency(a.funded),
                  currency(a.reserved),
                  currency(a.available),
                  <span>
                    {currency(a.amount)} {a.excused && <Badge>Excused</Badge>}
                  </span>,
                ])}
              />
              <details
                className="my-4 rounded-md border border-border p-3"
                open={run.status === "BLOCKED"}
              >
                <summary className="cursor-pointer text-xs">
                  Verification checks (
                  {run.result.checks.filter((c) => c.result !== "PASS").length}{" "}
                  blocking)
                </summary>
                <div className="mt-3 space-y-2">
                  {run.result.checks.map((c, i) => (
                    <p
                      key={i}
                      className={`text-xs ${c.result === "PASS" ? "text-muted-foreground" : "text-destructive"}`}
                    >
                      <strong>
                        {c.result} · {c.code}
                      </strong>{" "}
                      — {c.message}
                      {c.investorId
                        ? " " +
                          data.records.find((r) => r.id === c.investorId)?.data
                            .name
                        : ""}
                    </p>
                  ))}
                </div>
              </details>
              <p className="break-all font-mono text-[10px] text-muted-foreground">
                Input receipt: {run.input_hash}
              </p>
              {run.status === "READY_FOR_APPROVAL" && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    This personal sandbox allows self-approval, which is
                    recorded in the audit history.
                  </p>
                  <Field label="Approval reason">
                    <Input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                  <Button
                    disabled={pending || !reason.trim()}
                    onClick={() =>
                      act(`${f}/runs/${run.id}/approve`, {
                        inputHash: run.input_hash,
                        resultHash: run.result_hash,
                        reason,
                      }).catch(() => {})
                    }
                  >
                    Approve this exact calculation
                  </Button>
                  <Button
                    secondary
                    disabled={pending || !reason.trim()}
                    onClick={() =>
                      act(`${f}/runs/${run.id}/reject`, {
                        inputHash: run.input_hash,
                        resultHash: run.result_hash,
                        reason,
                      }).catch(() => {})
                    }
                  >
                    Reject for revision
                  </Button>
                </div>
              )}
              {run.status === "APPROVED" && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    disabled={pending}
                    onClick={() =>
                      act(`${f}/runs/${run.id}/export`).catch(() => {})
                    }
                  >
                    Generate draft notices
                  </Button>
                  <Link to="/audit" className="text-xs text-primary">
                    Open exports →
                  </Link>
                </div>
              )}
            </>
          )}
        </Panel>
      )}
    </>
  );
}
function Scenarios({ data, f, act, pending }: any) {
  const [amount, setAmount] = useState("3000000.00");
  const [asOf, setAsOf] = useState(today());
  return (
    <>
      <Panel title="Distribution scenario">
        <p className="mb-4 text-sm text-muted-foreground">
          Simulation only. Supports a first distribution with return of capital,
          simple Actual/365 preferred return, no catch-up, and residual split.
          Unsupported terms block the calculation.
        </p>
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            act(`${f}/scenarios`, { amount, asOf }).catch(() => {});
          }}
        >
          <Field label="Distributable amount (USD)">
            <Input
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Distribution date">
            <Input
              required
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </Field>
          <Button disabled={pending}>Save scenario</Button>
        </form>
      </Panel>
      {data.runs
        .filter((r) => r.kind === "scenario")
        .map((r) => (
          <Panel key={r.id} title={`Scenario · ${r.input.asOf}`}>
            <Badge>SIMULATION · does not post financial records</Badge>
            <Table
              headers={[
                "Return of capital",
                "Preferred return",
                "LP residual",
                "GP residual",
                "Total",
              ]}
              rows={[
                [
                  r.result.returnOfCapital,
                  r.result.preferredReturn,
                  r.result.lpResidual,
                  r.result.gpResidual,
                  r.result.total,
                ].map(currency),
              ]}
            />
          </Panel>
        ))}
    </>
  );
}
function Report({ data, f }: any) {
  const report = useQuery({
    queryKey: ["sandbox", data.fund.id, "report", data.records, data.calls],
    queryFn: () => request(`${f}/report`),
  });
  const rows = report.data?.positions || [];
  return (
    <Panel
      title="Investor capital summary"
      action={
        <Button
          secondary
          disabled={!report.data}
          onClick={() =>
            download(
              "investor-capital-summary.json",
              JSON.stringify({ fund: data.fund, ...report.data }, null, 2),
              "application/json",
            )
          }
        >
          Export report
        </Button>
      }
    >
      <ErrorBox error={report.error} />
      <p className="mb-3 text-xs text-muted-foreground">
        {report.data?.basis} · As of {report.data?.asOf}
      </p>
      <Table
        headers={[
          "Investor",
          "Commitment",
          "Contributions",
          "Outstanding calls",
        ]}
        rows={rows.map((r) => [
          r.name,
          currency(r.commitment),
          currency(r.funded),
          currency(r.reserved),
        ])}
      />
    </Panel>
  );
}
function Audit({ data, f, act, pending }: any) {
  const artifacts = useQuery({
    queryKey: ["sandbox", data.fund.id, "artifacts", data.events[0]?.id],
    queryFn: () => request(`${f}/artifacts`),
  });
  return (
    <>
      <Panel title="Draft notices and workflow receipts">
        <ErrorBox error={artifacts.error} />
        <Table
          headers={["File", "Content hash", "Download"]}
          rows={(artifacts.data || []).map((a) => [
            a.filename,
            <span className="break-all font-mono text-[10px]">{a.sha256}</span>,
            <a className="text-primary" href={`${base}${f}/artifacts/${a.id}`}>
              Download
            </a>,
          ])}
        />
      </Panel>
      <Panel title="Document processing jobs">
        <Table
          headers={["Job", "State", "Attempts", "Action"]}
          rows={data.jobs.map((j) => [
            j.id,
            <div>
              <Badge>{j.status}</Badge>
              {j.error && <p>{j.error}</p>}
            </div>,
            j.attempts,
            j.status === "FAILED" ? (
              <Button
                disabled={pending || j.attempts >= 3}
                secondary
                onClick={() => act(`${f}/jobs/${j.id}/retry`).catch(() => {})}
              >
                Retry
              </Button>
            ) : null,
          ])}
        />
      </Panel>
      <Panel title="Append-only activity">
        <Table
          headers={["When", "Action", "Details"]}
          rows={data.events.map((e) => [
            new Date(e.created_at).toLocaleString(),
            e.action,
            <details>
              <summary className="cursor-pointer text-primary">
                View event
              </summary>
              <pre className="mt-2 max-w-lg overflow-auto whitespace-pre-wrap text-[10px]">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            </details>,
          ])}
        />
      </Panel>
    </>
  );
}
function Settings({ data, act, pending, onReset }: any) {
  const [confirmation, setConfirmation] = useState("");
  const archive = useQuery({
    queryKey: ["sandbox", "archive", data.generation],
    queryFn: () => request("/archive"),
  });
  return (
    <>
      <Panel title="Reset your sandbox">
        <p className="mb-4 text-sm text-muted-foreground">
          Restore the fictional fund in a new generation. Your earlier records
          and uploaded documents remain archived. Other reviewers’ sandboxes are
          unaffected.
        </p>
        <form
          className="flex max-w-md items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            act("/reset", { generation: data.generation, confirmation })
              .then(onReset)
              .catch(() => {});
          }}
        >
          <Field label="Type RESET">
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </Field>
          <Button disabled={pending || confirmation !== "RESET"}>
            Reset sandbox
          </Button>
        </form>
      </Panel>
      <Panel title="Your archived uploads">
        <Table
          headers={["Document", "Version", "Open"]}
          rows={(archive.data || []).map((d) => [
            d.filename,
            d.version,
            <a
              className="text-primary"
              target="_blank"
              rel="noreferrer"
              href={`${base}/funds/${d.fund_id}/documents/${d.id}/content`}
            >
              Open archived source
            </a>,
          ])}
        />
      </Panel>
      <Panel title="Scope">
        <p className="text-sm leading-6 text-muted-foreground">
          Records, document processing, review decisions, capital-call
          calculations and approvals persist. Payment execution, document
          delivery, external integrations and tokenization are not connected.
          This workspace uses local processing and never silently substitutes
          fictional answers for uploaded documents.
        </p>
      </Panel>
    </>
  );
}
export default function SandboxApp() {
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <BrowserRouter>
          <Workspace />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
