import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { base, request, currency, today, download } from "./api";
import {
  inputClass,
  Field,
  Input,
  Select,
  Button,
  Panel,
  Badge,
  Table,
  ErrorBox,
} from "./ui";
export function Operations({ path, data, f, act, pending, onReset }: any) {
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
  if (path === "/settlement")
    return <Calls data={data} f={f} act={act} pending={pending} />;
  if (path === "/distribution" || path === "/scenarios")
    return <Scenarios data={data} f={f} act={act} pending={pending} />;
  if (path === "/cap-table" || path === "/reports")
    return <Report data={data} f={f} />;
  if (path === "/audit" || path === "/admin/jobs")
    return <Audit data={data} f={f} act={act} pending={pending} />;
  return <Settings data={data} act={act} pending={pending} onReset={onReset} />;
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
