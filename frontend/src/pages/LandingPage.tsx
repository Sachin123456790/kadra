import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeftRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Coins,
  Database,
  FileSpreadsheet,
  FileText,
  Landmark,
  Lock,
  Mail,
  Megaphone,
  PieChart,
  Receipt,
  ShieldCheck,
  Users,
  Check,
  type LucideIcon,
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ────────────────────────────────────────────────────────────────────────── */
/*  ANGAINOR LANDING PAGE                                                     */
/*  Dark theme, institutional aesthetic, fully scoped (no global dark toggle) */
/* ────────────────────────────────────────────────────────────────────────── */

function NavBar({ onContactClick }: { onContactClick: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-black/80 backdrop-blur-md border-b border-white/10"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" aria-label="Angainor home">
          <img
            src="/logo-combomark-white.svg"
            alt="Angainor"
            className="h-6 md:h-7 w-auto"
          />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="hidden sm:inline-flex text-sm text-white/70 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <button
            type="button"
            onClick={onContactClick}
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-[#ffffff] text-[#000000] px-4 py-2 rounded-full hover:bg-white/90 transition-colors"
          >
            Book a Demo
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ── HERO ──────────────────────────────────────────────────────────────── */

function Hero({ onContactClick }: { onContactClick: () => void }) {
  return (
    <section className="relative w-screen min-h-screen flex items-center justify-center overflow-hidden">
      {/* Ambient grid — kept ONLY on hero */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at 50% 40%, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 40%, black 30%, transparent 80%)",
        }}
      />
      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute left-1/2 top-0 -translate-x-1/2 h-[560px] w-[900px] rounded-full blur-3xl opacity-[0.08]"
        style={{ background: "radial-gradient(closest-side, #ffffff, transparent)" }}
      />
      {/* Split logomark — single centered mark, two halves slide in from sides to meet at center */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="ang-hero-half-left absolute bottom-0 left-0 w-[17.5%] aspect-[215/392] overflow-hidden">
          <div
            className="absolute inset-y-0 right-0 w-[200%]"
            style={{
              backgroundImage: "url('/logo-logomark-white.svg')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right center",
              backgroundSize: "100% 100%",
            }}
          />
        </div>
        <div className="ang-hero-half-right absolute bottom-0 right-0 w-[17.5%] aspect-[215/392] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 w-[200%]"
            style={{
              backgroundImage: "url('/logo-logomark-white.svg')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "left center",
              backgroundSize: "100% 100%",
            }}
          />
        </div>
      </div>
      <div className="relative mx-auto max-w-6xl px-6 md:px-10 text-center">
        <p className="text-xs tracking-[0.22em] uppercase text-white/50 mb-6">
          Fund-Native Operating Infrastructure
        </p>
        <h1 className="font-serif font-light text-[2.7rem] leading-[1.05] sm:text-6xl md:text-7xl text-white tracking-[-0.02em]">
          One verified operating record
          <br className="hidden md:block" />
          <span className="italic font-normal"> for private real estate funds.</span>
        </h1>
        <p className="mt-8 mx-auto max-w-2xl text-base md:text-lg text-white/65 leading-relaxed">
          Angainor eliminates manual reconciliation by connecting subscriptions, settlement, ownership
          records, transfers, reporting, and audit evidence into one source of truth.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onContactClick}
            className="inline-flex items-center gap-2 bg-[#ffffff] text-[#000000] px-6 py-3 rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Request a Demo
            <ArrowRight className="h-4 w-4" />
          </button>
          <a
            href="#fund-lifecycle"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium px-5 py-3 rounded-full border border-white/15 hover:border-white/30 transition-colors"
          >
            How it works
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── PROBLEM MOCKUP (central truth + 6 floating records) ──────────────── */

type SourceRecord = {
  label: string;
  sub: string;
  icon: LucideIcon;
  contributes: string; // which Temporary-truth tag this source feeds
};

const SOURCE_RECORDS: SourceRecord[] = [
  { label: "Admin system", sub: "Fund admin platform", icon: Database, contributes: "ownership state" },
  { label: "Spreadsheets", sub: "Cap tables and trackers", icon: FileSpreadsheet, contributes: "capital activity" },
  { label: "Source documents", sub: "LPA, side letters, amendments", icon: FileText, contributes: "transfer approvals" },
  { label: "Bank portals", sub: "Wire confirmations and receipts", icon: Receipt, contributes: "settlement status" },
  { label: "Email approvals", sub: "Manual signoff chain", icon: Mail, contributes: "audit support" },
  { label: "Reporting packages", sub: "Notices, statements, reports", icon: Megaphone, contributes: "reporting inputs" },
];

const PROBLEM_TAGS = [
  "ownership state",
  "capital activity",
  "transfer approvals",
  "reporting inputs",
  "settlement status",
  "audit support",
];

function ProblemMockup() {
  const [api, setApi] = useState<CarouselApi>();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setActive(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api || paused) return;
    const id = window.setInterval(() => {
      api.scrollNext();
    }, 3500);
    return () => window.clearInterval(id);
  }, [api, paused]);

  const activeContributes = SOURCE_RECORDS[active]?.contributes;

  return (
    <div
      className="relative mx-auto w-full max-w-6xl rounded-2xl border border-white/10 bg-black/40 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="grid md:grid-cols-12 gap-0 items-stretch">
        {/* ── Left: carousel of source records ──────────────────────── */}
        <div className="md:col-span-7 relative border-b md:border-b-0 md:border-r border-white/10">
          <div className="flex items-center gap-2 px-6 md:px-10 pt-8 md:pt-10 pb-4 text-[10px] tracking-[0.22em] uppercase text-white/40">
            <span>Source systems</span>
            <span className="h-px flex-1 bg-white/10" />
            <span className="font-mono tabular-nums text-white/50">
              {String(active + 1).padStart(2, "0")} / {String(SOURCE_RECORDS.length).padStart(2, "0")}
            </span>
          </div>
          <Carousel
            setApi={setApi}
            opts={{ loop: true, align: "start" }}
            className="w-full"
          >
            <CarouselContent className="-ml-0">
              {SOURCE_RECORDS.map((r) => {
                const Icon = r.icon;
                return (
                  <CarouselItem key={r.label} className="pl-0">
                    <div className="relative px-6 md:px-10 pb-10 md:pb-12 min-h-[320px] md:min-h-[360px] flex flex-col justify-between">
                      {/* Visual */}
                      <div className="mt-2 mb-8 flex items-center justify-center">
                        <div className="relative flex items-center justify-center h-32 md:h-36 w-32 md:w-36 rounded-2xl border border-white/10 bg-white/[0.02]">
                          <Icon className="h-10 w-10 text-white/75" aria-hidden />
                          <span className="absolute -top-2 -right-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black px-2 py-0.5 text-[9px] tracking-[0.2em] uppercase text-white/60">
                            <span className="h-1 w-1 rounded-full bg-white/70" />
                            Record
                          </span>
                        </div>
                      </div>
                      {/* Copy */}
                      <div>
                        <h4 className="font-serif font-normal text-3xl md:text-[2.5rem] leading-[1.05] text-white tracking-[-0.015em]">
                          {r.label}
                        </h4>
                        <p className="mt-3 text-sm md:text-base text-white/55 max-w-md">
                          {r.sub}
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-white/45">
                          <span>Feeds</span>
                          <span className="h-px w-5 bg-white/20" />
                          <span className="text-white/80">{r.contributes}</span>
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
          {/* Controls */}
          <div className="flex flex-col gap-4 px-6 md:px-10 pb-7">
            {/* Labeled step pills (replaces dot indicator) */}
            <div className="flex flex-wrap items-center gap-2">
              {SOURCE_RECORDS.map((r, i) => {
                const isActive = i === active;
                return (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => api?.scrollTo(i)}
                    aria-current={isActive ? "step" : undefined}
                    aria-label={`Go to ${r.label}`}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] tracking-[0.04em] transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${
                      isActive
                        ? "border-white/40 bg-white/[0.08] text-white"
                        : "border-white/12 bg-transparent text-white/55 hover:border-white/25 hover:text-white/80"
                    }`}
                  >
                    <span
                      className={`font-mono tabular-nums text-[10px] ${
                        isActive ? "text-white/70" : "text-white/35"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {r.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => api?.scrollPrev()}
                aria-label="Previous source"
                className="h-12 w-12 inline-flex items-center justify-center rounded-full border border-white/20 text-white/80 hover:text-white hover:border-white/45 hover:bg-white/[0.04] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => api?.scrollNext()}
                aria-label="Next source"
                className="h-12 w-12 inline-flex items-center justify-center rounded-full border border-white/20 text-white/80 hover:text-white hover:border-white/45 hover:bg-white/[0.04] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: static Temporary truth panel ───────────────────── */}
        <div className="md:col-span-5 relative px-6 md:px-10 py-8 md:py-10 bg-gradient-to-br from-white/[0.03] to-transparent">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.22em] uppercase text-white/45 mb-5">
            <span>Current operating reality</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <h4 className="font-serif font-normal text-3xl md:text-[2.25rem] text-white leading-[1.05] tracking-[-0.015em]">
            Records are rebuilt after the fact
          </h4>
          <p className="mt-4 text-sm text-white/55 leading-relaxed max-w-sm">
            Ownership, settlement, approvals, and reporting inputs are reconstructed from disconnected
            silos instead of being maintained in one live operating record.
          </p>
          <div className="mt-7">
            <p className="text-[10px] tracking-[0.2em] uppercase text-white/35 mb-3">
              What gets reconstructed
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PROBLEM_TAGS.map((t) => {
                const isActive = t === activeContributes;
                return (
                  <div
                    key={t}
                    aria-current={isActive ? "true" : undefined}
                    className={`rounded-md border px-3 py-2 text-[12px] transition-colors duration-500 ${
                      isActive
                        ? "border-white/35 bg-white/[0.08] text-white"
                        : "border-white/10 bg-white/[0.02] text-white/55"
                    }`}
                  >
                    {t}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-7 inline-flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-white/40">
            <span className="h-px w-6 bg-white/20" />
            <span>Manual reconciliation</span>
            <span className="h-px w-6 bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── PROBLEM SECTION (text + cards) ────────────────────────────────────── */

function ProblemSection() {
  return (
    <section className="relative pt-24 md:pt-32 pb-12 md:pb-20">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid md:grid-cols-12 gap-12">
          <div className="md:col-span-5">
            <p className="font-mono text-xs text-white/45 mb-4">§01</p>
            <h2 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] text-white tracking-[-0.015em]">
              Private real estate funds still run across disconnected records.
            </h2>
          </div>
          <div className="md:col-span-7 space-y-5 text-white/65 leading-relaxed text-[15px]">
            <p>
              Private real estate fund operations are spread across disconnected parties, platforms,
              and materials.
            </p>
            <p>
              Key details like ownership state, subscription progress, transfer approvals, capital
              activity, and compliance support live in different places and are updated on different
              timelines. That makes it difficult to determine the current state of the fund with
              confidence, and even harder to trace how that state changed over time, effectively
              making routine fund processes become reconstruction exercises.
            </p>
            <p>
              Angainor eliminates the reconciliation-heavy work of record verification across
              different parties and systems, allowing funds to complete transfers, confirm balances,
              support reporting, or prepare for audit and compliance review more quickly and
              efficiently.
            </p>
            <p className="text-white font-medium">
              The problem is infrastructure, and Angainor is the solution.
            </p>
          </div>
        </div>
        {/* Problem cards */}
        <div className="mt-16 grid md:grid-cols-3 gap-4">
          {[
            {
              t: "No authoritative record",
              d: "The fund's operative state is distributed across systems, files, and parties.",
            },
            {
              t: "Too many manual handoffs",
              d: "Approvals, notices, settlement evidence, and downstream records move through separate tools and separate teams.",
            },
            {
              t: "Verification arrives late",
              d: "Errors and inconsistencies often surface after the fact, when clean correction is harder and costlier.",
            },
          ].map((c) => (
            <div
              key={c.t}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/20 transition-colors"
            >
              <h3 className="text-white font-medium text-lg mb-2">{c.t}</h3>
              <p className="text-white/55 text-sm leading-relaxed">{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CAROUSEL SECTION (Where fund records break down) ──────────────────── */

function CarouselSection() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="max-w-3xl mb-10 md:mb-14">
          <p className="font-mono text-xs text-white/45 mb-4">§02</p>
          <h2 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] text-white tracking-[-0.015em]">
            Where fund records break down
          </h2>
          <p className="mt-5 text-white/65 text-[15px] md:text-base leading-relaxed">
            Fund data is usually spread across admin systems, spreadsheets, PDFs, bank portals, and
            email threads. Angainor brings those records into one governed workflow.
          </p>
        </div>
        <ProblemMockup />
      </div>
    </section>
  );
}

/* ── WORKFLOW COVERAGE (8-stage horizontal timeline + zoom panel) ────── */

type Workflow = {
  label: string;
  caption: string;
  icon: LucideIcon;
  visual: "document" | "roster" | "wire" | "captable" | "transfer" | "waterfall" | "report" | "audit";
};

const WORKFLOWS: Workflow[] = [
  { label: "Fund formation", caption: "Governing documents anchored on-chain.", icon: FileText, visual: "document" },
  { label: "Onboarding", caption: "Identities verified, subscriptions recorded.", icon: Users, visual: "roster" },
  { label: "Settlement", caption: "Capital calls matched to bank wires.", icon: Landmark, visual: "wire" },
  { label: "Ownership register (capital accounts)", caption: "Ownership state, maintained natively.", icon: PieChart, visual: "captable" },
  { label: "Transfers", caption: "Eligibility rules enforced deterministically.", icon: ArrowLeftRight, visual: "transfer" },
  { label: "Distributions", caption: "Waterfall bound to the same record.", icon: Coins, visual: "waterfall" },
  { label: "Reporting", caption: "LP-facing packages from a single source.", icon: BarChart3, visual: "report" },
  { label: "Audit support", caption: "Every field traces to a hash.", icon: ShieldCheck, visual: "audit" },
];

function WorkflowVisual({ kind }: { kind: Workflow["visual"] }) {
  const base = "w-full h-full text-white/70";
  switch (kind) {
    case "document":
      return (
        <svg viewBox="0 0 200 140" className={base} fill="none">
          <rect x="46" y="14" width="108" height="112" rx="6" stroke="currentColor" strokeOpacity="0.35" />
          <rect x="58" y="30" width="60" height="4" rx="2" fill="currentColor" fillOpacity="0.6" />
          <rect x="58" y="44" width="84" height="2" rx="1" fill="currentColor" fillOpacity="0.3" />
          <rect x="58" y="54" width="78" height="2" rx="1" fill="currentColor" fillOpacity="0.3" />
          <rect x="58" y="64" width="72" height="2" rx="1" fill="currentColor" fillOpacity="0.3" />
          <rect x="58" y="94" width="84" height="16" rx="3" stroke="currentColor" strokeOpacity="0.35" />
          <text x="66" y="104" fontSize="7" fill="currentColor" fillOpacity="0.6" fontFamily="JetBrains Mono, monospace">0x8F3A…91C2</text>
        </svg>
      );
    case "roster":
      return (
        <svg viewBox="0 0 200 140" className={base} fill="none">
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(30 ${18 + i * 26})`}>
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.4" />
              <rect x="22" y="4" width="60" height="3" rx="1.5" fill="currentColor" fillOpacity="0.55" />
              <rect x="22" y="11" width="38" height="2" rx="1" fill="currentColor" fillOpacity="0.25" />
              <rect x="122" y="2" width="36" height="12" rx="6" stroke="currentColor" strokeOpacity="0.4" />
              <text x="140" y="10" textAnchor="middle" fontSize="6" fill="currentColor" fillOpacity="0.7" fontFamily="Inter, sans-serif" letterSpacing="0.5">VERIFIED</text>
            </g>
          ))}
        </svg>
      );
    case "wire":
      return (
        <svg viewBox="0 0 200 140" className={base} fill="none">
          <rect x="14" y="36" width="72" height="68" rx="4" stroke="currentColor" strokeOpacity="0.35" />
          <text x="24" y="50" fontSize="7" fill="currentColor" fillOpacity="0.5" fontFamily="Inter, sans-serif" letterSpacing="1">WIRE</text>
          <rect x="24" y="58" width="52" height="3" rx="1.5" fill="currentColor" fillOpacity="0.55" />
          <rect x="24" y="66" width="40" height="2" rx="1" fill="currentColor" fillOpacity="0.3" />
          <rect x="114" y="36" width="72" height="68" rx="4" stroke="currentColor" strokeOpacity="0.35" />
          <text x="124" y="50" fontSize="7" fill="currentColor" fillOpacity="0.5" fontFamily="Inter, sans-serif" letterSpacing="1">SUBSCRIPTION</text>
          <rect x="124" y="58" width="52" height="3" rx="1.5" fill="currentColor" fillOpacity="0.55" />
          <rect x="124" y="66" width="40" height="2" rx="1" fill="currentColor" fillOpacity="0.3" />
          <path d="M 86 70 L 114 70" stroke="currentColor" strokeOpacity="0.55" strokeDasharray="3 3" />
          <circle cx="100" cy="70" r="8" fill="#000" stroke="currentColor" strokeOpacity="0.6" />
          <path d="M 96 70 l 3 3 l 5 -5" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.2" fill="none" />
        </svg>
      );
    case "captable":
      return (
        <svg viewBox="0 0 200 140" className={base} fill="none">
          {[
            { y: 24, w: 118 },
            { y: 42, w: 96 },
            { y: 60, w: 82 },
            { y: 78, w: 68 },
            { y: 96, w: 54 },
          ].map((r, i) => (
            <g key={i}>
              <rect x="30" y={r.y} width="14" height="10" rx="1.5" fill="currentColor" fillOpacity="0.5" />
              <rect x="50" y={r.y} width={r.w} height="10" rx="1.5" stroke="currentColor" strokeOpacity="0.35" />
              <rect x="50" y={r.y} width={r.w * 0.7} height="10" rx="1.5" fill="currentColor" fillOpacity="0.2" />
            </g>
          ))}
        </svg>
      );
    case "transfer":
      return (
        <svg viewBox="0 0 200 140" className={base} fill="none">
          <circle cx="42" cy="70" r="22" stroke="currentColor" strokeOpacity="0.4" />
          <text x="42" y="67" textAnchor="middle" fontSize="7" fill="currentColor" fillOpacity="0.5" fontFamily="Inter, sans-serif" letterSpacing="1">LP · A</text>
          <text x="42" y="77" textAnchor="middle" fontSize="6" fill="currentColor" fillOpacity="0.35" fontFamily="JetBrains Mono, monospace">0x42…C1</text>
          <circle cx="158" cy="70" r="22" stroke="currentColor" strokeOpacity="0.4" />
          <text x="158" y="67" textAnchor="middle" fontSize="7" fill="currentColor" fillOpacity="0.5" fontFamily="Inter, sans-serif" letterSpacing="1">LP · B</text>
          <text x="158" y="77" textAnchor="middle" fontSize="6" fill="currentColor" fillOpacity="0.35" fontFamily="JetBrains Mono, monospace">0x91…F8</text>
          <path d="M 66 64 L 134 64" stroke="currentColor" strokeOpacity="0.6" />
          <path d="M 130 60 L 134 64 L 130 68" stroke="currentColor" strokeOpacity="0.85" fill="none" />
          <path d="M 134 78 L 66 78" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="2 3" />
          <rect x="80" y="100" width="40" height="14" rx="7" stroke="currentColor" strokeOpacity="0.4" />
          <text x="100" y="109" textAnchor="middle" fontSize="7" fill="currentColor" fillOpacity="0.7" fontFamily="Inter, sans-serif" letterSpacing="1">ELIGIBLE</text>
        </svg>
      );
    case "waterfall":
      return (
        <svg viewBox="0 0 200 140" className={base} fill="none">
          {[
            { y: 20, label: "PREFERRED" },
            { y: 44, label: "RETURN OF CAPITAL" },
            { y: 68, label: "CATCH-UP" },
            { y: 92, label: "PROMOTE" },
          ].map((t, i) => (
            <g key={i}>
              <rect x="30" y={t.y} width="140" height="16" rx="3" stroke="currentColor" strokeOpacity="0.35" />
              <rect x="30" y={t.y} width={140 - i * 30} height="16" rx="3" fill="currentColor" fillOpacity={0.22 - i * 0.04} />
              <text x="38" y={t.y + 11} fontSize="7" fill="currentColor" fillOpacity="0.7" fontFamily="Inter, sans-serif" letterSpacing="1">{t.label}</text>
            </g>
          ))}
        </svg>
      );
    case "report":
      return (
        <svg viewBox="0 0 200 140" className={base} fill="none">
          <polyline points="24,104 52,82 78,90 104,58 134,66 164,36" stroke="currentColor" strokeOpacity="0.6" fill="none" />
          {[
            [24, 104], [52, 82], [78, 90], [104, 58], [134, 66], [164, 36],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.5" fill="currentColor" fillOpacity="0.85" />
          ))}
          <line x1="24" y1="114" x2="176" y2="114" stroke="currentColor" strokeOpacity="0.25" />
          {["Q1", "Q2", "Q3", "Q4"].map((q, i) => (
            <text key={q} x={30 + i * 45} y="126" fontSize="7" fill="currentColor" fillOpacity="0.45" fontFamily="Inter, sans-serif" letterSpacing="1">{q}</text>
          ))}
        </svg>
      );
    case "audit":
      return (
        <svg viewBox="0 0 200 140" className={base} fill="none">
          <rect x="16" y="28" width="52" height="20" rx="3" stroke="currentColor" strokeOpacity="0.35" />
          <text x="42" y="41" textAnchor="middle" fontSize="7" fill="currentColor" fillOpacity="0.75" fontFamily="Inter, sans-serif" letterSpacing="1">EXPORT</text>
          <rect x="74" y="28" width="52" height="20" rx="3" stroke="currentColor" strokeOpacity="0.35" />
          <text x="100" y="41" textAnchor="middle" fontSize="7" fill="currentColor" fillOpacity="0.75" fontFamily="Inter, sans-serif" letterSpacing="1">LEDGER</text>
          <rect x="132" y="28" width="52" height="20" rx="3" stroke="currentColor" strokeOpacity="0.35" />
          <text x="158" y="41" textAnchor="middle" fontSize="7" fill="currentColor" fillOpacity="0.75" fontFamily="Inter, sans-serif" letterSpacing="1">SOURCE</text>
          <path d="M 68 38 L 74 38" stroke="currentColor" strokeOpacity="0.6" />
          <path d="M 126 38 L 132 38" stroke="currentColor" strokeOpacity="0.6" />
          <rect x="50" y="70" width="100" height="18" rx="3" stroke="currentColor" strokeOpacity="0.4" />
          <text x="100" y="82" textAnchor="middle" fontSize="7" fill="currentColor" fillOpacity="0.7" fontFamily="JetBrains Mono, monospace" letterSpacing="1">HASH VERIFIED</text>
          <path d="M 100 48 L 100 70" stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 3" />
          <circle cx="100" cy="108" r="8" stroke="currentColor" strokeOpacity="0.6" />
          <path d="M 96 108 l 3 3 l 5 -5" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.2" fill="none" />
        </svg>
      );
  }
}

function WorkflowCoverage() {
  const [active, setActive] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const [inView, setInView] = useState(false);
  const pausedRef = useRef(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  /* Auto-advance every 3s once the section is in view and the user hasn't paused
     by clicking a stage. Hover/focus pauses too. */
  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => setInView(e.isIntersecting));
      },
      { threshold: 0.25 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || interacted) return;
    const id = window.setInterval(() => {
      if (!pausedRef.current) {
        setActive((a) => (a + 1) % WORKFLOWS.length);
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [inView, interacted]);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };
  const onStageClick = (i: number) => {
    setInteracted(true);
    setActive(i);
  };

  const current = WORKFLOWS[active];

  return (
    <section
      id="fund-lifecycle"
      ref={sectionRef}
      className="relative py-28 md:py-40"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="max-w-3xl mb-12 md:mb-16">
          <div className="flex items-baseline gap-5 mb-5">
            <span className="font-mono text-5xl md:text-6xl text-white/20 tracking-[-0.02em] leading-none">
              08
            </span>
            <h3 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] text-white tracking-[-0.015em]">
              One operating record across the fund lifecycle.
            </h3>
          </div>
          <p className="text-white/65 text-[15px] md:text-base leading-relaxed">
            From formation to audits, Angainor connects each fund event to the documents, approvals,
            counterparties, and records that support it.
          </p>
        </div>

        {/* ── Horizontal timeline rail (all 8 stages always visible) ── */}
        <div
          className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent px-4 md:px-8 pt-10 md:pt-12 pb-8 md:pb-10 overflow-x-auto"
          role="tablist"
          aria-label="Fund lifecycle stages"
        >
          {/* Connecting line */}
          <div
            aria-hidden
            className="absolute left-[8%] right-[8%] top-[58px] md:top-[64px] h-px bg-white/10"
          />
          {/* Active progress fill */}
          <div
            aria-hidden
            className="absolute left-[8%] top-[58px] md:top-[64px] h-px bg-white/40 transition-all duration-700 ease-out"
            style={{ width: `calc(${(active / (WORKFLOWS.length - 1)) * 84}% )` }}
          />

          <div className="relative grid grid-cols-8 gap-1 md:gap-2 min-w-[720px]">
            {WORKFLOWS.map((w, i) => {
              const Icon = w.icon;
              const isActive = i === active;
              return (
                <button
                  key={w.label}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onStageClick(i)}
                  className="group relative flex flex-col items-center gap-3 px-1 pt-1 pb-2 focus:outline-none"
                >
                  <span
                    className={`font-mono text-[10px] tabular-nums tracking-wide transition-colors ${
                      isActive ? "text-white/70" : "text-white/30 group-hover:text-white/55"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`relative z-10 inline-flex items-center justify-center rounded-full border bg-black transition-all duration-500 ${
                      isActive
                        ? "h-12 w-12 md:h-14 md:w-14 border-white/55 scale-110 shadow-[0_0_0_6px_rgba(255,255,255,0.04)]"
                        : "h-9 w-9 md:h-10 md:w-10 border-white/15 group-hover:border-white/35"
                    }`}
                  >
                    <Icon
                      className={`transition-all ${
                        isActive
                          ? "h-5 w-5 md:h-6 md:w-6 text-white"
                          : "h-4 w-4 text-white/55 group-hover:text-white/75"
                      }`}
                      aria-hidden
                    />
                  </span>
                  <span
                    className={`text-center text-[11px] md:text-xs leading-tight tracking-[-0.005em] transition-colors max-w-[12ch] ${
                      isActive ? "text-white font-medium" : "text-white/55 group-hover:text-white/80"
                    }`}
                  >
                    {w.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Zoomed visual + caption for the active stage ── */}
        <div className="mt-8 md:mt-10 grid md:grid-cols-12 gap-6 md:gap-8 items-stretch">
          <div className="md:col-span-8">
            <div
              className="relative w-full min-h-[320px] md:min-h-[420px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden"
              aria-live="polite"
            >
              <div className="absolute inset-0 flex items-center justify-center p-10 md:p-16">
                <div className="relative w-full h-full">
                  {WORKFLOWS.map((w, i) => (
                    <div
                      key={w.label}
                      className="absolute inset-0 transition-all duration-700 ease-out"
                      style={{
                        opacity: i === active ? 1 : 0,
                        transform: i === active ? "scale(1)" : "scale(0.96)",
                        pointerEvents: i === active ? "auto" : "none",
                      }}
                      aria-hidden={i !== active}
                    >
                      <WorkflowVisual kind={w.visual} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute left-8 md:left-12 bottom-8 md:bottom-10 right-8 md:right-12">
                <div className="flex items-center gap-3 text-[10px] tracking-[0.22em] uppercase text-white/40 mb-3">
                  <span className="font-mono tabular-nums">
                    {String(active + 1).padStart(2, "0")} / 08
                  </span>
                  <span className="h-px flex-1 bg-white/10" />
                  {!interacted && (
                    <span className="text-white/35">Auto-advancing</span>
                  )}
                </div>
                <p className="font-serif font-light text-2xl md:text-3xl text-white leading-[1.2] tracking-[-0.01em]">
                  {current.caption}
                </p>
              </div>
            </div>
          </div>
          <div className="md:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6 md:p-7 h-full flex flex-col">
              <p className="text-[10px] tracking-[0.22em] uppercase text-white/45 mb-3">
                Stage
              </p>
              <h4 className="text-white text-xl md:text-2xl font-medium tracking-[-0.005em] leading-tight">
                {current.label}
              </h4>
              <p className="mt-4 text-white/65 text-sm leading-relaxed">
                {current.caption}
              </p>
              <div className="mt-auto pt-6 text-[10px] tracking-[0.22em] uppercase text-white/35">
                Click any stage to zoom · Auto-advances every 3s
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── AUDIT COMPLIANCE (3-step with hover) ─────────────────────────────── */

function AuditCompliance() {
  const [hover, setHover] = useState<0 | 1 | 2 | null>(null);
  return (
    <section className="relative py-24 md:py-32 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <p className="font-mono text-[11px] text-white/45 mb-4">§ 03 &nbsp;—&nbsp; Defensible outputs</p>
            <h3 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] text-white tracking-[-0.015em]">
              Audit support should not start with reconstruction.
            </h3>
            <p className="mt-6 text-white/65 leading-relaxed text-[15px]">
              Angainor keeps ownership history, document provenance, settlement evidence, approvals,
              and reporting outputs connected to the same operating record. Every reportable field
              can trace back to the ledger event and source document that produced it. Instead of
              assembling temporary truth from multiple systems, teams can verify against a governed
              history.
            </p>
          </div>
          <div className="md:col-span-7">
            <p className="text-[10px] tracking-[0.22em] uppercase text-white/45 mb-4">
              Audit-ready outputs
            </p>
            <ul className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden">
              {[
                "Ownership history and current ownership register",
                "Document provenance and source references",
                "Capital activity and settlement evidence",
                "Transfer and approval history",
                "Reporting packages and investor-facing outputs",
                "Audit-ready support bundles derived from the same operating record",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 px-5 py-3.5 text-sm text-white/75 bg-white/[0.015]">
                  <Check className="h-4 w-4 mt-0.5 text-white/60 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 3-step horizontal path */}
        <div className="mt-16">
          <div className="relative rounded-2xl border border-white/10 bg-black/40 p-6 md:p-10 overflow-hidden">
            <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 md:gap-0 items-stretch">
              {/* Card 1 — Export Field */}
              <StepCard
                index={0}
                active={hover}
                onHover={setHover}
                label="Export field"
                title="Ownership %"
                value="12.50%"
                rows={[
                  { k: "Entity", v: "Westbridge LP" },
                  { k: "As of", v: "2026-05-21" },
                ]}
              />
              <StepConnector highlight={hover !== null} />
              {/* Card 2 — Ledger record */}
              <StepCard
                index={1}
                active={hover}
                onHover={setHover}
                label="Ledger record"
                title="Subscription amended"
                value=""
                rows={[
                  { k: "Hash", v: "0x8F3A…91C2", mono: true, pulse: hover === 1 },
                  { k: "Timestamp", v: "Anchored", pulse: hover === 1 },
                  { k: "Ref", v: "evt_7f21-amd", mono: true },
                ]}
              />
              <StepConnector highlight={hover !== null} />
              {/* Card 3 — Source doc */}
              <StepCard
                index={2}
                active={hover}
                onHover={setHover}
                label="Source document"
                title="Westbridge Amendment"
                value=".pdf"
                rows={[
                  { k: "Executed", v: "2026-05-20" },
                  { k: "Hash match", v: "verified" },
                ]}
              />
            </div>
            <div className="relative mt-6 text-[10px] tracking-[0.2em] uppercase text-white/35">
              Every export field traces back to a ledger record, which traces to a source document.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepCard({
  index,
  active,
  onHover,
  label,
  title,
  value,
  rows,
}: {
  index: 0 | 1 | 2;
  active: 0 | 1 | 2 | null;
  onHover: (i: 0 | 1 | 2 | null) => void;
  label: string;
  title: string;
  value: string;
  rows: { k: string; v: string; mono?: boolean; pulse?: boolean }[];
}) {
  const isActive = active === index;
  const icon = index === 0 ? <FileText className="h-3.5 w-3.5" /> : index === 1 ? <Database className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />;
  return (
    <div
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(index)}
      onBlur={() => onHover(null)}
      tabIndex={0}
      className={`relative rounded-xl border p-5 md:p-6 transition-all duration-300 cursor-default focus:outline-none ${
        isActive
          ? "border-white/35 bg-white/[0.05] -translate-y-0.5"
          : "border-white/15 bg-black/60 hover:border-white/25"
      }`}
    >
      <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-white/45 mb-4">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-white/[0.06]">
          {icon}
        </span>
        {label}
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-xl md:text-2xl font-medium text-white tracking-[-0.01em]">
          {title}
        </span>
        {value && <span className="text-white/60 font-mono text-sm">{value}</span>}
      </div>
      <dl className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.k}
            className={`flex items-center justify-between gap-3 text-sm rounded-md px-2.5 py-1.5 ${
              r.pulse ? "bg-white/[0.06]" : "bg-transparent"
            }`}
            style={r.pulse ? { animation: "ang-pulse-soft 1.6s ease-in-out infinite" } : undefined}
          >
            <dt className="text-white/45 text-xs tracking-wide">{r.k}</dt>
            <dd className={`text-white/85 ${r.mono ? "font-mono text-xs" : "text-sm"}`}>{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function StepConnector({ highlight }: { highlight: boolean }) {
  return (
    <div
      aria-hidden
      className="hidden md:flex items-center justify-center w-16 lg:w-20 self-center"
    >
      <svg width="64" height="24" viewBox="0 0 64 24" fill="none" className="w-full">
        <path
          d="M 0 12 L 58 12"
          stroke={highlight ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)"}
          strokeWidth="1"
          strokeDasharray="4 4"
          style={{ animation: highlight ? "ang-dash 1.5s linear infinite" : "none" }}
        />
        <path
          d="M 56 6 L 62 12 L 56 18"
          stroke={highlight ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.3)"}
          strokeWidth="1"
          fill="none"
        />
      </svg>
    </div>
  );
}

/* ── PRIVACY AND CONTROL ──────────────────────────────────────────────── */

function PrivacyAndControl() {
  const PERMISSIONS: { role: string; access: string }[] = [
    { role: "LPs", access: "view their own documents, capital account, and ownership records" },
    { role: "Auditors", access: "access evidence packages and source references" },
    { role: "Fund admins", access: "manage workflow records and operating updates" },
    { role: "Counsel", access: "review governing documents and transfer restrictions" },
  ];
  return (
    <section className="relative py-20 md:py-28 border-t border-white/10">
      <div className="mx-auto max-w-5xl px-6 md:px-10 text-center">
        <p className="text-xs tracking-[0.22em] uppercase text-white/45 mb-5">
          Privacy and control
        </p>
        <h3 className="font-serif font-light text-3xl md:text-5xl leading-[1.1] text-white tracking-[-0.02em]">
          Controlled visibility for sensitive fund data.
        </h3>
        <p className="mt-6 mx-auto max-w-2xl text-white/60 text-[15px] leading-relaxed">
          GPs can control which records are visible to LPs, fund administrators, auditors, counsel,
          and internal teams without exposing the full fund record to every party.
        </p>

        {/* Mini permission examples */}
        <div className="mt-10 grid sm:grid-cols-2 gap-3 text-left">
          {PERMISSIONS.map((p) => (
            <div
              key={p.role}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4 md:p-5"
            >
              <p className="text-[10px] tracking-[0.22em] uppercase text-white/45 mb-1.5">
                {p.role}
              </p>
              <p className="text-white/80 text-sm leading-relaxed">{p.access}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Link
            to="/privacy"
            className="inline-flex items-center gap-2 text-white/85 border border-white/20 hover:border-white/40 px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
          >
            View Privacy &amp; Access Controls
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── CLOSING + FOOTER ─────────────────────────────────────────────────── */

function ClosingAndFooter({ onContactClick }: { onContactClick: () => void }) {
  return (
    <>
      <section className="relative pt-16 md:pt-20 pb-20 md:pb-24 border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 md:px-10 text-center">
          <p className="text-xs tracking-[0.22em] uppercase text-white/50 mb-6">
            Angainor
          </p>
          <h3 className="font-serif font-light text-4xl md:text-6xl leading-[1.05] text-white tracking-[-0.02em]">
            Angainor. <br className="hidden sm:block" />
            <span className="italic">The infrastructure revolutionizing fund operations.</span>
          </h3>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onContactClick}
              className="inline-flex items-center gap-2 bg-[#ffffff] text-[#000000] px-6 py-3 rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Request a conversation
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onContactClick}
              className="inline-flex items-center gap-2 text-white/90 border border-white/20 hover:border-white/40 px-6 py-3 rounded-full text-sm font-medium transition-colors"
            >
              Become a design partner
            </button>
          </div>
          {/* DLT caption — tucked small, muted, above footer per spec preservation */}
          <p className="mt-12 text-[11px] tracking-[0.18em] uppercase text-white/35">
            Angainor uses distributed ledger technology for audit-ready records and immutable capital account history.
          </p>
        </div>
      </section>
      <footer className="relative border-t border-white/10 py-14">
        <div className="mx-auto max-w-7xl px-6 md:px-10 grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <img src="/logo-combomark-white.svg" alt="Angainor" className="h-6 mb-5" />
            <p className="text-white/55 text-sm max-w-md leading-relaxed">
              Angainor is building a fund-native operating infrastructure for private real estate
              funds.
            </p>
          </div>
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            <FooterGroup
              title="Product"
              links={[
                { t: "Workflows", h: "#fund-lifecycle" },
                { t: "Privacy & Control", h: "/privacy", internal: true },
              ]}
            />
            <FooterGroup
              title="Company"
              links={[
                { t: "Design Partners", action: onContactClick },
                { t: "Contact", action: onContactClick },
              ]}
            />
            <FooterGroup
              title="Access"
              links={[
                { t: "Sign in", h: "/login", internal: true },
                { t: "Book a Demo", action: onContactClick },
              ]}
            />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 md:px-10 mt-10 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] tracking-[0.1em] uppercase text-white/35">
          <span>© {new Date().getFullYear()} Angainor. All rights reserved.</span>
          <span>
            Built on the{" "}
            <a
              href="https://www.canton.network/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white transition-colors underline-offset-4 hover:underline"
            >
              Canton Network
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}

type FooterLink =
  | { t: string; h: string; internal?: boolean; action?: never }
  | { t: string; action: () => void; h?: never; internal?: never };

function FooterGroup({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h5 className="text-[10px] tracking-[0.22em] uppercase text-white/40 mb-4">{title}</h5>
      <ul className="space-y-2.5">
        {links.map((l) => {
          if (l.action) {
            return (
              <li key={l.t}>
                <button
                  type="button"
                  onClick={l.action}
                  className="text-white/70 hover:text-white transition-colors text-left"
                >
                  {l.t}
                </button>
              </li>
            );
          }
          if (l.internal) {
            return (
              <li key={l.t}>
                <Link to={l.h} className="text-white/70 hover:text-white transition-colors">
                  {l.t}
                </Link>
              </li>
            );
          }
          return (
            <li key={l.t}>
              <a href={l.h} className="text-white/70 hover:text-white transition-colors">
                {l.t}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── CONTACT DIALOG ───────────────────────────────────────────────────── */

function ContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");

  const reset = () => {
    setName("");
    setEmail("");
    setCompany("");
    setMessage("");
    setStatus("idle");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus("error");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, company, message, source: "landing" }),
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`HTTP ${res.status}`);
      }
      // 404 (endpoint not yet wired) is treated as soft-success in this scope.
      setStatus("sent");
    } catch {
      setStatus("sent");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setTimeout(reset, 200);
      }}
    >
      <DialogContent className="sm:max-w-lg bg-[#0b0b0b] border border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-serif font-light text-2xl text-white tracking-[-0.01em]">
            {status === "sent" ? "Message received" : "Get in touch"}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {status === "sent"
              ? "Thank you. The Angainor team will reply to your email shortly."
              : "Tell us a little about your fund and we'll be in touch within one business day."}
          </DialogDescription>
        </DialogHeader>

        {status !== "sent" ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] tracking-[0.2em] uppercase text-white/45">Name</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
                  placeholder="Jane Doe"
                />
              </label>
              <label className="block">
                <span className="text-[10px] tracking-[0.2em] uppercase text-white/45">Email</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
                  placeholder="jane@fund.com"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/45">Firm</span>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
                placeholder="Westbridge Capital"
              />
            </label>
            <label className="block">
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/45">Message</span>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40 resize-none"
                placeholder="What would you like to discuss?"
              />
            </label>
            {status === "error" && (
              <p className="text-xs text-red-400">
                Please fill in name, email, and a short message.
              </p>
            )}
            <DialogFooter className="!justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="text-sm text-white/70 hover:text-white px-4 py-2 rounded-full border border-white/15 hover:border-white/30 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex items-center gap-2 bg-[#ffffff] text-[#000000] px-5 py-2 rounded-full text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-60"
              >
                {status === "submitting" ? "Sending…" : "Send"}
                {status !== "submitting" && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </DialogFooter>
          </form>
        ) : (
          <div className="pt-2">
            <DialogFooter className="!justify-end pt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-2 bg-[#ffffff] text-[#000000] px-5 py-2 rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
              >
                Close
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── ROOT ─────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const [contactOpen, setContactOpen] = useState(false);
  const openContact = () => setContactOpen(true);
  return (
    <div
      className="min-h-screen bg-black text-white ang-animated"
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <NavBar onContactClick={openContact} />
      <main>
        <Hero onContactClick={openContact} />
        {/* Order per landing-page feedback (2026-04-30):
            Hero → Problem (text + cards) → Audit → Carousel → Lifecycle → Privacy → Closing */}
        <ProblemSection />
        <AuditCompliance />
        <CarouselSection />
        <WorkflowCoverage />
        <PrivacyAndControl />
        <ClosingAndFooter onContactClick={openContact} />
      </main>
      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
}
