import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { request } from "./api";
import { ErrorBox } from "./ui";
import { fundUrl } from "./navigation";

type PendingFile = {
  key: string;
  file: File;
  type: string;
  effective: string;
  id?: string;
  error?: string;
};
const types = [
  ["lpa", "Governing agreement (LPA)"],
  ["amendment", "Amendment"],
  ["side_letter", "Side letter"],
  ["subscription_agreement", "Subscription documents"],
  ["ppm", "Private placement memorandum"],
  ["spreadsheet", "Distribution workbook / spreadsheet"],
  ["financial_statement", "Financial statement"],
  ["other", "Other"],
];
const steps = [
  "Create the fund",
  "Add documents",
  "Confirm & precedence",
  "Build the rulebook",
];
export function Onboarding({ data, actor, act, pending }: any) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasFund = !!new URLSearchParams(location.search).get("fund");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState("Real estate");
  const [reviewer, setReviewer] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [error, setError] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const fundId = data?.fund?.id;
  useEffect(() => {
    if (fundId) {
      setStep(data.fund.onboarding?.step === 4 ? 4 : 2);
      setName(data.fund.name);
      setStrategy(data.fund.onboarding?.strategy || "Real estate");
      setReviewer(data.fund.onboarding?.reviewerEmail || "");
    }
  }, [fundId]);
  const addFiles = (incoming: FileList | File[]) => {
    const valid: PendingFile[] = [];
    const invalid: string[] = [];
    for (const file of Array.from(incoming)) {
      if (
        !/\.(pdf|docx|xlsx|csv)$/i.test(file.name) ||
        file.size === 0 ||
        file.size > 10 * 1024 * 1024
      ) {
        invalid.push(file.name);
        continue;
      }
      valid.push({
        key: crypto.randomUUID(),
        file,
        type: /\.(xlsx|csv)$/i.test(file.name) ? "spreadsheet" : "other",
        effective: "",
      });
    }
    setFiles((current) => [
      ...current,
      ...valid.filter(
        (v) =>
          !current.some(
            (c) =>
              c.file.name === v.file.name &&
              c.file.size === v.file.size &&
              c.file.lastModified === v.file.lastModified,
          ),
      ),
    ]);
    setError(
      invalid.length
        ? new Error(
            `Use PDF, DOCX, XLSX or CSV files under 10 MB. Could not add: ${invalid.join(", ")}`,
          )
        : null,
    );
  };
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fundId) {
      setStep(2);
      return;
    }
    try {
      const result = await act("/funds", {
        name,
        strategy,
        reviewerEmail: reviewer,
        currency: "USD",
      });
      navigate(fundUrl("/funds/new", result.id));
    } catch (e) {
      setError(e);
    }
  };
  const build = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const entry of files.filter((f) => !f.id)) {
        const form = new FormData();
        form.append("documentType", entry.type);
        if (entry.effective) form.append("effectiveDate", entry.effective);
        form.append("file", entry.file);
        try {
          const uploaded = await act(`/funds/${fundId}/documents`, form);
          setFiles((current) =>
            current.map((f) =>
              f.key === entry.key
                ? { ...f, id: uploaded.id, error: undefined }
                : f,
            ),
          );
        } catch (e) {
          setFiles((current) =>
            current.map((f) =>
              f.key === entry.key ? { ...f, error: (e as Error).message } : f,
            ),
          );
          throw e;
        }
      }
      const latest = await request(`/state?fundId=${fundId}`);
      await act(`/funds/${fundId}/onboarding/confirm`, {
        revision: latest.fund.revision,
        documentIds: latest.documents.map((d: any) => d.id),
        reason,
      });
      setStep(4);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  if (hasFund && !data)
    return (
      <p className="p-8 text-sm text-muted-foreground">Loading fund setup…</p>
    );
  const persisted = (data?.documents || []).filter(
    (d: any) => !files.some((f) => f.id === d.id),
  );
  const docCount = persisted.length + files.length;
  const processing = (data?.documents || []).filter((d: any) =>
    ["QUEUED", "PROCESSING"].includes(d.status),
  );
  const failed = (data?.documents || []).filter(
    (d: any) => d.status === "FAILED",
  );
  const unreviewed = (data?.facts || []).filter(
    (f: any) => f.state === "UNREVIEWED",
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="cr-setup-rail flex shrink-0 flex-col border-b border-border bg-sidebar/60 p-5 md:w-56 md:border-b-0 md:border-r xl:w-64">
        <p className="workspace-eyebrow">Your organization</p>
        <p className="mt-2 text-xs">{actor.email.split("@")[1]}</p>
        <ol className="mt-6 flex gap-3 md:flex-col md:gap-5">
          {steps.map((title, i) => (
            <li
              key={title}
              aria-current={step === i + 1 ? "step" : undefined}
              className={`flex flex-1 items-center gap-3 text-xs md:flex-auto ${step === i + 1 ? "text-foreground" : "text-muted-foreground"}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${step === i + 1 ? "border-primary bg-primary text-white" : step > i + 1 ? "border-success/25 text-success" : "border-border"}`}
              >
                {step > i + 1 ? <Check size={13} /> : i + 1}
              </span>
              <span className="hidden md:inline">{title}</span>
            </li>
          ))}
        </ol>
        <div className="mt-auto hidden pt-10 md:block">
          <div className="rounded-md border border-border bg-card/60 p-3">
            <ShieldCheck size={14} className="mb-2 text-success" />
            <p className="text-[11px] leading-5 text-muted-foreground">
              Uploads stay inside your private sandbox. Document text is treated
              as source material, never as instructions.
            </p>
          </div>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-8 xl:px-12">
          <div className="mx-auto max-w-4xl space-y-5">
            {step === 1 && (
              <form
                id="create-fund-form"
                onSubmit={create}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-xl font-medium tracking-tight">
                    {fundId ? "Your fund" : "Create your fund"}
                  </h1>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    This is the container everything lives in: its own
                    documents, rulebook, and reviews. You can add more funds
                    later.
                  </p>
                </div>
                <label className="block">
                  <span className="workspace-eyebrow">Fund legal name</span>
                  <input
                    autoFocus
                    className="cr-input mt-2 w-full"
                    required
                    maxLength={200}
                    aria-label="Fund legal name"
                    placeholder="Enter the full legal name"
                    value={name}
                    disabled={!!fundId}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <fieldset>
                  <legend className="workspace-eyebrow mb-2">Strategy</legend>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Real estate",
                      "Credit",
                      "Buyout",
                      "Venture",
                      "Other",
                    ].map((s) => (
                      <button
                        type="button"
                        key={s}
                        aria-pressed={s === strategy}
                        disabled={!!fundId}
                        className={
                          s === strategy ? "cr-button" : "cr-button-secondary"
                        }
                        onClick={() => setStrategy(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="block">
                  <span className="workspace-eyebrow">Base currency</span>
                  <select
                    className="cr-input mt-2 block"
                    aria-label="Base currency"
                    value="USD"
                    onChange={() => {}}
                  >
                    <option>USD</option>
                  </select>
                  <span className="mt-2 block text-[11px] text-muted-foreground">
                    USD is supported by the current calculation engine.
                  </span>
                </label>
                <label className="block">
                  <span className="workspace-eyebrow">Invite a reviewer</span>
                  <input
                    type="email"
                    aria-label="Reviewer email"
                    className="cr-input mt-2 w-full"
                    placeholder="Counsel or your fund administrator’s email"
                    value={reviewer}
                    disabled={!!fundId}
                    onChange={(e) => setReviewer(e.target.value)}
                  />
                  <span className="mt-2 block text-[11px] leading-5 text-muted-foreground">
                    Optional reviewer contact, saved with this fund. Invitations
                    and access sharing are not sent from this sandbox.
                  </span>
                </label>
              </form>
            )}
            {step === 2 && (
              <>
                <div>
                  <h1 className="text-xl font-medium tracking-tight">
                    Add every governing document
                  </h1>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Drop them all at once: the governing agreement, amendments,
                    side letters, subscriptions, and the distribution workbook.
                  </p>
                </div>
                <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
                  <div>
                    <input
                      ref={picker}
                      type="file"
                      multiple
                      accept=".pdf,.docx,.xlsx,.csv"
                      aria-label="Choose governing documents"
                      className="sr-only"
                      onChange={(e) => {
                        if (e.target.files) addFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <button
                      className="cr-upload-zone"
                      onClick={() => picker.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        addFiles(e.dataTransfer.files);
                      }}
                    >
                      <Upload size={22} className="text-primary" />
                      <span className="mt-4 block text-sm">
                        Drag files here or click to add
                      </span>
                      <span className="mt-2 block text-[11px] text-muted-foreground">
                        PDF · DOCX · XLSX · CSV · Local scanned PDF OCR
                      </span>
                    </button>
                    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                      Files are selected locally, then uploaded after you
                      confirm their types on the next step. 10 MB per file, 80
                      PDF pages.
                    </p>
                    <div className="mt-4 space-y-2">
                      {persisted.map((d: any) => (
                        <div key={d.id} className="cr-upload-row">
                          <FileText size={14} />
                          <span className="min-w-0 flex-1 truncate">
                            {d.filename}
                          </span>
                          <span className="text-[10px] text-success">
                            Uploaded
                          </span>
                        </div>
                      ))}
                      {files.map((f) => (
                        <div key={f.key} className="cr-upload-row">
                          <FileText size={14} />
                          <span className="min-w-0 flex-1 truncate">
                            {f.file.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {f.id ? "Uploaded" : "Selected"}
                          </span>
                          {!f.id && (
                            <button
                              aria-label={`Remove ${f.file.name}`}
                              onClick={() =>
                                setFiles(
                                  files.filter((item) => item.key !== f.key),
                                )
                              }
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h2 className="workspace-eyebrow mb-3">
                      Suggested fund package
                    </h2>
                    <div className="rounded-md border border-border bg-card">
                      {types.slice(0, 6).map(([value, label]) => (
                        <div
                          key={value}
                          className="flex gap-2 border-b border-border/60 p-3 text-xs last:border-0"
                        >
                          <Circle
                            size={13}
                            className="shrink-0 text-muted-foreground"
                          />
                          <span>{label}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            suggested
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                      Add whatever this fund actually has. None of these
                      categories is required. You can add more from the fund’s
                      Documents page later.
                    </p>
                  </div>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <div>
                  <h1 className="text-xl font-medium tracking-tight">
                    Confirm types and precedence
                  </h1>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Confirm each document’s type and stated effective date.
                    Investor-specific applicability and which provision governs
                    are reviewed in Fund terms before use in calculations.
                  </p>
                </div>
                <div className="space-y-3">
                  {persisted.map((d: any) => (
                    <div
                      key={d.id}
                      className="rounded-md border border-border bg-card p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <FileText size={14} />
                        <span className="min-w-0 flex-1 break-words">
                          {d.filename}
                        </span>
                        <span>
                          {types.find(
                            ([value]) => value === d.document_type,
                          )?.[1] || d.document_type}
                        </span>
                        <span className="text-muted-foreground">
                          {d.effective_date || "Date not stated"} · v{d.version}
                        </span>
                      </div>
                    </div>
                  ))}
                  {files.map((entry) => (
                    <div
                      key={entry.key}
                      className="rounded-md border border-border bg-card p-4"
                    >
                      <div className="grid items-center gap-3 lg:grid-cols-[minmax(0,1fr)_220px_160px]">
                        <span className="flex min-w-0 items-center gap-2 text-xs">
                          <FileText size={14} className="shrink-0" />
                          <span className="break-words">{entry.file.name}</span>
                        </span>
                        <select
                          aria-label={`Type for ${entry.file.name}`}
                          className="cr-input text-xs"
                          disabled={!!entry.id || busy}
                          value={entry.type}
                          onChange={(e) =>
                            setFiles(
                              files.map((f) =>
                                f.key === entry.key
                                  ? { ...f, type: e.target.value }
                                  : f,
                              ),
                            )
                          }
                        >
                          {types.map(([value, label]) => (
                            <option value={value} key={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label={`Effective date for ${entry.file.name}`}
                          type="date"
                          className="cr-input text-xs"
                          disabled={!!entry.id || busy}
                          value={entry.effective}
                          onChange={(e) =>
                            setFiles(
                              files.map((f) =>
                                f.key === entry.key
                                  ? { ...f, effective: e.target.value }
                                  : f,
                              ),
                            )
                          }
                        />
                      </div>
                      {entry.error && (
                        <p
                          role="alert"
                          className="mt-2 text-xs text-destructive"
                        >
                          {entry.error}
                        </p>
                      )}
                      {entry.id && (
                        <p className="mt-2 text-[10px] text-success">
                          Uploaded. Original version preserved.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Leave an unknown date blank. Missing dates and unreviewed
                  interpretations remain flagged. Later amendments and side
                  letters do not override existing rules until a reviewer
                  confirms their scope and effective date.
                </p>
                <label className="block text-xs">
                  Package review notes
                  <textarea
                    className="cr-input mt-2 w-full"
                    rows={2}
                    aria-label="Package review notes"
                    placeholder="Describe the document package and any unresolved precedence questions."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <label className="flex items-start gap-2 text-xs leading-5">
                  <input
                    className="mt-1 accent-orange-600"
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  I have checked these types and dates. Extracted terms still
                  require review before they become governing rules.
                </label>
              </>
            )}
            {step === 4 && (
              <>
                <div>
                  <h1 className="flex items-center gap-3 text-xl font-medium tracking-tight">
                    {processing.length
                      ? "Building the fund brain"
                      : "Your fund brain is ready for review"}
                    {processing.length > 0 && (
                      <Loader2
                        size={18}
                        className="animate-spin text-primary"
                      />
                    )}
                  </h1>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Reading the documents you confirmed and identifying
                    potential fund terms. Every interpretation needs source
                    evidence and human review.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {
                    (data?.documents || []).filter((d: any) =>
                      ["READY", "NEEDS_REVIEW"].includes(d.status),
                    ).length
                  }{" "}
                  of {data?.documents?.length || 0} documents parsed.
                </p>
                <div className="space-y-2">
                  {(data?.documents || []).map((d: any) => (
                    <div key={d.id} className="cr-upload-row">
                      {["QUEUED", "PROCESSING"].includes(d.status) ? (
                        <Loader2
                          size={14}
                          className="animate-spin text-primary"
                        />
                      ) : (
                        <FileText size={14} className="text-primary" />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {d.filename}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {d.status.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
                {failed.length > 0 && (
                  <p role="alert" className="text-xs text-destructive">
                    {failed.length} documents could not be processed. Review the
                    error and retry from Activity & exports.
                  </p>
                )}
                <div className="grid grid-cols-3 gap-3 border-y border-border py-5">
                  {[
                    ["Documents", data?.documents?.length || 0],
                    ["Term suggestions", unreviewed.length],
                    ["Reviewed rules", data?.rulebook?.rules?.length || 0],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-2xl font-medium">{value}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Financial rows stay as source evidence until you post reviewed
                  financial records. Extraction does not automatically approve
                  rules or record transactions.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link className="cr-button" to={fundUrl("/ask", fundId)}>
                    Open the Fund Brain
                    <ArrowRight size={14} />
                  </Link>
                  <Link
                    className="cr-button-secondary"
                    to={fundUrl("/waterfall", fundId)}
                  >
                    Review fund structure
                  </Link>
                  <Link
                    className="self-center text-xs text-muted-foreground hover:text-foreground"
                    to={fundUrl("/dashboard", fundId)}
                  >
                    or go to the fund overview
                  </Link>
                </div>
              </>
            )}
            <ErrorBox error={error} />
          </div>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card/70 px-5 py-4 md:px-8">
          <button
            className="flex items-center gap-2 text-xs disabled:opacity-50"
            disabled={busy || pending}
            onClick={() => {
              setError(null);
              step === 1 || step === 4
                ? navigate("/portfolio")
                : setStep(step - 1);
            }}
          >
            <ArrowLeft size={14} />
            {step === 4 ? "Portfolio" : "Back"}
          </button>
          <span className="ml-auto text-[11px] text-muted-foreground">
            Step {step} of 4
          </span>
          {step === 1 && (
            <button
              className="cr-button"
              type="submit"
              form="create-fund-form"
              disabled={pending || !name.trim()}
            >
              {pending ? "Creating…" : "Continue"}
              <ArrowRight size={13} />
            </button>
          )}
          {step === 2 && (
            <button
              className="cr-button"
              disabled={!docCount}
              onClick={() => setStep(3)}
            >
              {docCount ? "Continue" : "Add a document to continue"}
              <ArrowRight size={13} />
            </button>
          )}
          {step === 3 && (
            <button
              className="cr-button"
              disabled={
                busy || pending || !confirmed || !reason.trim() || !docCount
              }
              onClick={build}
            >
              {busy ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Uploading & building…
                </>
              ) : (
                <>
                  Build the rulebook
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
