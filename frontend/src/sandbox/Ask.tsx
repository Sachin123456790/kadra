import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUp,
  BriefcaseBusiness,
  ExternalLink,
  FileBarChart,
  FileText,
  HandCoins,
  Loader2,
  MessageSquare,
  PanelRightClose,
  PieChart,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { base, request, today } from "./api";
import { ErrorBox } from "./ui";
import { fundUrl } from "./navigation";

const starters = [
  "What is the preferred return rate, and how is it compounded?",
  "Walk me through the distribution waterfall tier by tier.",
  "Which side letters change notice requirements or investor exceptions?",
  "How much notice do LPs need before a capital call?",
];
const actions = [
  { label: "Capital Call", path: "/settlement", icon: HandCoins },
  { label: "Distribution", path: "/distribution", icon: PieChart },
  { label: "Scenario Model", path: "/scenarios", icon: SlidersHorizontal },
  { label: "Investor Report", path: "/reports", icon: FileBarChart },
];
const later = [
  { label: "Fee & Expense Review", icon: FileText },
  { label: "Consent Request", icon: ShieldCheck },
  { label: "Investment Memo", icon: BriefcaseBusiness },
  { label: "Investor Terms Matrix", icon: Users },
];

export function Ask({ data }: any) {
  const fundId = data.fund.id;
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const conversationId = new URLSearchParams(location.search).get(
    "conversation",
  );
  const [question, setQuestion] = useState("");
  const [asOf, setAsOf] = useState(today());
  const [source, setSource] = useState<any>(null);
  const [actionsOpen, setActionsOpen] = useState(true);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [submittedConversation, setSubmittedConversation] = useState<
    string | null
  >(null);
  const end = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const currentConversation = useRef(conversationId);
  currentConversation.current = conversationId;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const conversation = useQuery({
    queryKey: ["sandbox", fundId, "conversation", conversationId],
    queryFn: () => request(`/funds/${fundId}/conversations/${conversationId}`),
    enabled: !!conversationId,
  });
  const mutation = useMutation({
    mutationFn: (body: any) =>
      request(`/funds/${fundId}/questions`, "POST", body),
  });
  useEffect(() => {
    setQuestion("");
    setSource(null);
  }, [conversationId]);
  const answers = conversationId ? conversation.data?.answers || [] : [];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [answers.length, pendingQuestion]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || mutation.isPending) return;
    const sentFrom = conversationId;
    setSubmittedConversation(sentFrom);
    setPendingQuestion(question);
    try {
      const result = await mutation.mutateAsync({
        question,
        asOf,
        ...(conversationId ? { conversationId } : {}),
      });
      await qc.invalidateQueries({ queryKey: ["sandbox"] });
      if (mounted.current && currentConversation.current === sentFrom) {
        setQuestion("");
        navigate(
          fundUrl("/ask", fundId, { conversation: result.conversationId }),
          { replace: !sentFrom },
        );
      }
    } catch {
    } finally {
      setPendingQuestion("");
    }
  };
  const sourcePath = source
    ? `${base}/funds/${fundId}/documents/${source.documentId}/content#page=${source.locator?.page || 1}`
    : "";
  const sourceIsPdf =
    source &&
    (/\.(pdf|docx)$/i.test(source.filename) || source.locator?.rendition);
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-6 md:px-8">
          <div>
            <h1 className="text-xl font-medium tracking-tight">Fund Brain</h1>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Grounded answers about{" "}
              <span className="text-foreground">{data.fund.name}</span>, with
              source evidence you can open and review.
            </p>
          </div>
          <Link
            className="cr-button-secondary shrink-0"
            to={fundUrl("/ask", fundId)}
          >
            <Plus size={13} />
            <span className="hidden sm:inline">New conversation</span>
          </Link>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-8"
          aria-live="polite"
        >
          <div className="mx-auto max-w-4xl">
            {conversationId && conversation.isPending && (
              <p className="text-xs text-muted-foreground">
                Loading conversation…
              </p>
            )}
            <ErrorBox error={conversation.error} />
            {!conversationId && !pendingQuestion && (
              <div className="cr-ask-empty rounded-lg border border-dashed border-border bg-card/45 px-5 py-10 md:px-12 md:py-14">
                <Sparkles size={24} className="mx-auto mb-4 text-primary" />
                <h2 className="text-center text-sm font-medium">
                  Ask the document room a question
                </h2>
                <p className="mx-auto mt-2 max-w-md text-center text-xs leading-5 text-muted-foreground">
                  Answers draw on this fund’s parsed pages, reviewed terms, and
                  financial records. Try one of these:
                </p>
                <div className="mx-auto mt-5 max-w-xl space-y-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      className="block w-full rounded-md border border-border bg-card px-3 py-3 text-left text-xs transition-colors hover:border-primary/40 hover:bg-muted/30"
                      onClick={() => setQuestion(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-8">
              {answers.map((entry: any) => (
                <article key={entry.id} className="space-y-4">
                  <div className="ml-auto max-w-[90%] rounded-lg border border-border bg-muted/45 px-4 py-3">
                    <p className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                      You
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {entry.question}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Sparkles
                      size={18}
                      className="mt-1 shrink-0 text-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-[10px] text-muted-foreground">
                        {entry.answer.status === "INSUFFICIENT_EVIDENCE"
                          ? "Insufficient evidence"
                          : entry.answer.requiresReview
                            ? "AI draft · Review sources before acting"
                            : entry.answer.mode === "deterministic_rulebook"
                              ? "Reviewed fund terms"
                              : entry.answer.mode === "deterministic_records"
                                ? "Calculated from records"
                                : "Source evidence"}{" "}
                        · As of {entry.answer.asOf}
                      </p>
                      <div className="whitespace-pre-wrap text-[13px] leading-7">
                        {entry.answer.text}
                      </div>
                      {entry.answer.notice && (
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">
                          {entry.answer.notice}
                        </p>
                      )}
                      {!!entry.answer.citations?.length && (
                        <div className="mt-4">
                          <p className="workspace-eyebrow mb-2">Sources</p>
                          <div className="flex flex-wrap gap-2">
                            {entry.answer.citations.map(
                              (citation: any, i: number) => (
                                <button
                                  key={citation.id}
                                  className="cr-citation"
                                  title={citation.filename}
                                  aria-label={`Open source ${i + 1}: ${citation.filename}`}
                                  onClick={() =>
                                    setSource({
                                      ...citation,
                                      label: `S${i + 1}`,
                                    })
                                  }
                                >
                                  <span className="font-medium">S{i + 1}</span>
                                  <span className="max-w-44 truncate">
                                    {citation.filename}
                                  </span>
                                  <span className="opacity-70">
                                    v{citation.version} ·{" "}
                                    {citation.locator?.page
                                      ? `p. ${citation.locator.page}`
                                      : citation.locator?.sheet || "source"}
                                  </span>
                                </button>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                      {entry.answer.calculation && (
                        <details className="mt-4 rounded-md border border-border bg-card p-3 text-xs">
                          <summary className="cursor-pointer">
                            Calculation and source records
                          </summary>
                          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-[11px]">
                            {JSON.stringify(entry.answer.calculation, null, 2)}
                          </pre>
                        </details>
                      )}
                      {entry.answer.interpretationReceipt && (
                        <details className="mt-3 text-xs text-muted-foreground">
                          <summary className="cursor-pointer">
                            Review receipt · Rulebook v
                            {entry.answer.rulebookVersion}
                          </summary>
                          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-[10px]">
                            {JSON.stringify(
                              entry.answer.interpretationReceipt,
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {pendingQuestion && submittedConversation === conversationId && (
              <div className="mt-6 space-y-5">
                <div className="ml-auto max-w-[90%] rounded-lg border border-border bg-muted/45 p-4 text-sm">
                  {pendingQuestion}
                </div>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  Checking this fund’s sources and reviewed terms…
                </p>
              </div>
            )}
            <div ref={end} />
          </div>
        </div>
        <form
          className="shrink-0 border-t border-border bg-card/45 px-5 py-4 md:px-8"
          onSubmit={send}
        >
          <div className="mx-auto max-w-4xl space-y-2">
            <ErrorBox error={mutation.error} />
            <textarea
              aria-label="Fund question"
              className="cr-input w-full resize-none bg-card text-xs leading-6"
              rows={2}
              required
              maxLength={2000}
              placeholder="Ask about fees, waterfalls, side-letter rights, definitions…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex min-w-0 items-center gap-1.5 rounded border border-border px-2 py-1.5 text-[10px] text-muted-foreground">
                <MessageSquare size={12} className="text-primary" />
                <span className="max-w-40 truncate sm:max-w-60">
                  Scoped to{" "}
                  <span className="text-foreground">{data.fund.name}</span>
                </span>
              </span>
              <label className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                As of
                <input
                  type="date"
                  aria-label="Answer as of"
                  required
                  className="rounded border border-border bg-card p-1.5 text-[10px]"
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                />
              </label>
              <button
                className="cr-button"
                disabled={
                  mutation.isPending ||
                  !question.trim() ||
                  (!!conversationId && !conversation.data)
                }
              >
                {mutation.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ArrowUp size={13} />
                )}
                Ask
              </button>
            </div>
          </div>
        </form>
      </div>
      <aside
        aria-label="Fund actions"
        className={`hidden shrink-0 border-l border-border bg-sidebar/40 xl:flex xl:flex-col ${actionsOpen ? "w-[260px] p-4" : "w-11 p-2"}`}
      >
        <div className="mb-3 flex items-center justify-between text-xs">
          {actionsOpen && <span>Actions</span>}
          <button
            className="workspace-icon-button !h-6 !w-6"
            aria-label={actionsOpen ? "Collapse actions" : "Expand actions"}
            onClick={() => setActionsOpen(!actionsOpen)}
          >
            <PanelRightClose size={14} />
          </button>
        </div>
        {actionsOpen && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {actions.map((a) => (
                <Link
                  key={a.label}
                  className="rounded-md border border-border bg-card p-3 text-xs hover:border-primary/40"
                  to={fundUrl(a.path, fundId)}
                >
                  <a.icon size={16} className="mb-2 text-primary" />
                  {a.label}
                </Link>
              ))}
              {later.map((a) => (
                <div
                  key={a.label}
                  className="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground"
                >
                  <a.icon size={15} className="mb-2 opacity-60" />
                  {a.label}
                  <span className="mt-2 block text-[9px] opacity-70">
                    Coming soon
                  </span>
                </div>
              ))}
            </div>
            <p className="workspace-eyebrow mb-3 mt-7">Recent work</p>
            <div className="min-h-0 space-y-4 overflow-y-auto">
              {data.runs.slice(0, 6).map((run: any) => (
                <Link
                  key={run.id}
                  className="flex gap-2 text-xs"
                  to={fundUrl(
                    run.kind === "capital_call" ? "/settlement" : "/scenarios",
                    fundId,
                  )}
                >
                  <SlidersHorizontal
                    size={14}
                    className="mt-0.5 shrink-0 text-primary"
                  />
                  <div>
                    <p>
                      {run.kind === "capital_call"
                        ? "Capital call"
                        : "Distribution scenario"}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                      {run.status.toLowerCase().replaceAll("_", " ")}
                    </p>
                  </div>
                </Link>
              ))}
              {!data.runs.length && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Calculations and draft workflows will appear here.
                </p>
              )}
            </div>
          </>
        )}
      </aside>
      <Dialog open={!!source} onOpenChange={(open) => !open && setSource(null)}>
        <DialogContent className="flex h-[90dvh] max-w-[1200px] flex-col gap-3 p-4 sm:p-5">
          <DialogTitle className="pr-8 text-sm">
            {source?.filename} · Version {source?.version}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {source?.locator?.page
              ? `Page ${source.locator.page}`
              : `Sheet ${source?.locator?.sheet || "source"}`}{" "}
            · {source?.locator?.method || "Document evidence"}
          </DialogDescription>
          <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
            {sourceIsPdf && (
              <iframe
                title="Cited document page"
                src={sourcePath}
                className="min-h-[35vh] flex-1 rounded-md border border-border bg-muted"
              />
            )}
            <div
              className={`${sourceIsPdf ? "md:w-72" : "flex-1"} min-h-0 overflow-y-auto rounded-md border border-primary/25 bg-primary/5 p-4`}
            >
              <div className="flex items-center justify-between text-[10px] text-primary">
                <span>{source?.label} · Answer citation</span>
                <span>
                  {source?.locator?.page
                    ? `PAGE ${source.locator.page}`
                    : source?.locator?.cells}
                </span>
              </div>
              <blockquote className="mt-4 whitespace-pre-wrap text-xs leading-6">
                {source?.quote}
              </blockquote>
              <p className="mt-4 text-[10px] leading-5 text-muted-foreground">
                {source?.interpretations?.length
                  ? "Reviewed interpretations are recorded against this source."
                  : "Source evidence. Legal interpretation and precedence require review."}
              </p>
              <a
                className="mt-4 flex items-center gap-2 text-xs text-primary"
                href={sourcePath}
                target="_blank"
                rel="noreferrer"
              >
                Open full document
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
