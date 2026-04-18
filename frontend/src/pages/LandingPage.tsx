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
  Eye,
  EyeOff,
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  ANGAINOR LANDING PAGE                                                     */
/*  Dark theme, institutional aesthetic, fully scoped (no global dark toggle) */
/* ────────────────────────────────────────────────────────────────────────── */

const DEMO_CTA = "mailto:founders@angainor.io?subject=Angainor%20%E2%80%94%20Demo%20Request";
const DESIGN_PARTNER_CTA = "mailto:founders@angainor.io?subject=Angainor%20%E2%80%94%20Design%20Partner";

function NavBar() {
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
          <a
            href={DEMO_CTA}
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-white text-black px-4 py-2 rounded-full hover:bg-white/90 transition-colors"
          >
            Book a Demo
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}

/* ── HERO ──────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative pt-40 md:pt-52 pb-28 md:pb-40 overflow-hidden">
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
      <div className="relative mx-auto max-w-6xl px-6 md:px-10 text-center">
        <p className="text-xs tracking-[0.22em] uppercase text-white/50 mb-6">
          Fund-Native Operating Infrastructure
        </p>
        <h1 className="font-serif font-light text-[2.7rem] leading-[1.05] sm:text-6xl md:text-7xl text-white tracking-[-0.02em]">
          Bringing private real estate funds
          <br className="hidden md:block" />
          <span className="italic font-normal"> into one deterministic system of record.</span>
        </h1>
        <p className="mt-8 mx-auto max-w-2xl text-base md:text-lg text-white/65 leading-relaxed">
          Angainor eliminates manual reconciliation by replacing siloed and analog systems with a single
          source of truth.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <a
            href={DEMO_CTA}
            className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Request a Demo
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#what-angainor-does"
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
  { label: "Counsel docs", sub: "LPA, side letters, amendments", icon: FileText, contributes: "transfer approvals" },
  { label: "Spreadsheets", sub: "Cap tables and trackers", icon: FileSpreadsheet, contributes: "capital activity" },
  { label: "Email approvals", sub: "Manual signoff chain", icon: Mail, contributes: "audit support" },
  { label: "Bank evidence", sub: "Wire confirmations and receipts", icon: Receipt, contributes: "settlement status" },
  { label: "LP materials", sub: "Notices, statements, reports", icon: Megaphone, contributes: "reporting inputs" },
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
          <div className="flex items-center justify-between gap-4 px-6 md:px-10 pb-6">
            <div className="flex items-center gap-1.5">
              {SOURCE_RECORDS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => api?.scrollTo(i)}
                  aria-label={`Go to source ${i + 1}`}
                  className={`h-1 rounded-full transition-all ${
                    i === active ? "w-8 bg-white/85" : "w-3 bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => api?.scrollPrev()}
                aria-label="Previous source"
                className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/35 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => api?.scrollNext()}
                aria-label="Next source"
                className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/35 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
              >
                <ChevronRight className="h-4 w-4" />
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
            Temporary truth
          </h4>
          <p className="mt-4 text-sm text-white/55 leading-relaxed max-w-sm">
            Fund state is reconstructed on demand from partial records — not maintained natively in one governed system.
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

/* ── PROBLEM SECTION ───────────────────────────────────────────────────── */

function ProblemSection() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <ProblemMockup />
        <div className="mt-20 grid md:grid-cols-12 gap-12">
          <div className="md:col-span-5">
            <p className="font-mono text-xs text-white/45 mb-4">§01</p>
            <h2 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] text-white tracking-[-0.015em]">
              Private funds still run on disconnected records.
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
              t: "Too many handoffs",
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

/* ── WHAT ANGAINOR DOES ────────────────────────────────────────────────── */

function WhatAngainorDoes() {
  const tags = [
    "source-linked",
    "permissioned",
    "current-state aware",
    "append-only history",
    "settlement-aware",
    "audit-ready",
  ];
  return (
    <section id="what-angainor-does" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-white/10">
          {/* Left: light panel — eyebrow removed */}
          <div className="bg-[#f4f4f1] text-black p-10 md:p-12">
            <h3 className="font-serif text-3xl md:text-[2.5rem] leading-[1.1] tracking-[-0.015em] font-normal">
              Executed legal intent becomes structured fund data.
            </h3>
            <p className="mt-6 text-black/70 text-[15px] leading-relaxed">
              Angainor ingests governing documents, anchors provenance, maps approvals, validates
              settlement, maintains current ownership state, and connects downstream calculations to
              the same underlying record.
            </p>
            <p className="mt-4 text-black/70 text-[15px] leading-relaxed">
              Past states remain visible. The current state remains operative. All history is
              preserved and verifiable.
            </p>
          </div>
          {/* Right: dark mockup — only "Canonical" label remains */}
          <div className="bg-[#0a0a0a] p-10 md:p-12 flex flex-col justify-center">
            <div className="flex items-center justify-end mb-5">
              <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-white/55">
                Canonical
              </span>
            </div>
            <h4 className="text-white text-2xl md:text-[1.75rem] font-medium tracking-[-0.01em]">
              One governed record
            </h4>
            <div className="mt-7 grid grid-cols-2 gap-2.5">
              {tags.map((t) => (
                <div
                  key={t}
                  className="rounded-md border border-white/12 bg-white/[0.03] py-3 px-4 text-sm text-white/80"
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── WORKFLOW COVERAGE (Harvey-style cycling — single vertical list) ────── */

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
  { label: "Cap table", caption: "Ownership state, maintained natively.", icon: PieChart, visual: "captable" },
  { label: "Transfers", caption: "Eligibility rules enforced deterministically.", icon: ArrowLeftRight, visual: "transfer" },
  { label: "Distributions", caption: "Waterfall bound to the same record.", icon: Coins, visual: "waterfall" },
  { label: "Reporting", caption: "LP-facing packages from a single source.", icon: BarChart3, visual: "report" },
  { label: "Audit", caption: "Every field traces to a hash.", icon: ShieldCheck, visual: "audit" },
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
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) {
        setActive((a) => (a + 1) % WORKFLOWS.length);
      }
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  const current = WORKFLOWS[active];

  return (
    <section className="relative py-28 md:py-40">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="flex items-baseline gap-5 mb-20 md:mb-24">
          <span className="font-mono text-5xl md:text-6xl text-white/20 tracking-[-0.02em] leading-none">
            08
          </span>
          <h3 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] text-white tracking-[-0.015em]">
            One operating layer across the fund lifecycle.
          </h3>
        </div>
        <div
          className="grid md:grid-cols-12 gap-10 md:gap-16 items-stretch"
          onMouseEnter={pause}
          onMouseLeave={resume}
          onFocus={pause}
          onBlur={resume}
        >
          {/* Left: visual panel */}
          <div className="md:col-span-7 order-2 md:order-1 flex">
            <div
              className="relative w-full min-h-[360px] md:min-h-[480px] flex-1 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden"
              aria-live="polite"
            >
              {/* Stacked visuals — only active is visible */}
              <div className="absolute inset-0 flex items-center justify-center p-10 md:p-16">
                <div className="relative w-full h-full">
                  {WORKFLOWS.map((w, i) => (
                    <div
                      key={w.label}
                      className="absolute inset-0 transition-opacity duration-700 ease-out"
                      style={{
                        opacity: i === active ? 1 : 0,
                        pointerEvents: i === active ? "auto" : "none",
                      }}
                      aria-hidden={i !== active}
                    >
                      <WorkflowVisual kind={w.visual} />
                    </div>
                  ))}
                </div>
              </div>
              {/* Caption */}
              <div className="absolute left-8 md:left-12 bottom-8 md:bottom-10 right-8 md:right-12">
                <div className="flex items-center gap-3 text-[10px] tracking-[0.22em] uppercase text-white/40 mb-3">
                  <span className="font-mono tabular-nums">{String(active + 1).padStart(2, "0")} / 08</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
                <p className="font-serif font-light text-2xl md:text-3xl text-white leading-[1.2] tracking-[-0.01em]">
                  {current.caption}
                </p>
              </div>
            </div>
          </div>
          {/* Right: short-label cards */}
          <div className="md:col-span-5 order-1 md:order-2">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {WORKFLOWS.map((w, i) => {
                const Icon = w.icon;
                const isActive = i === active;
                return (
                  <button
                    key={w.label}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-pressed={isActive}
                    className={`group text-left rounded-xl border p-5 md:p-6 min-h-[110px] md:min-h-[120px] flex flex-col justify-between transition-all duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${
                      isActive
                        ? "border-white/30 bg-white/[0.05]"
                        : "border-white/10 bg-white/[0.015] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon
                        className={`h-[18px] w-[18px] transition-colors ${
                          isActive ? "text-white/85" : "text-white/35 group-hover:text-white/55"
                        }`}
                        aria-hidden
                      />
                      <span
                        className={`font-mono text-[10px] tabular-nums tracking-wide transition-colors ${
                          isActive ? "text-white/55" : "text-white/20"
                        }`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <span
                      className={`text-[15px] md:text-base font-medium tracking-[-0.005em] transition-colors ${
                        isActive ? "text-white" : "text-white/60 group-hover:text-white/80"
                      }`}
                    >
                      {w.label}
                    </span>
                  </button>
                );
              })}
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
              Angainor is designed to keep ownership history, document provenance, settlement
              records, approvals, and operating outputs connected to the same record. That changes
              the posture of audit and compliance work. Instead of assembling temporary truth from
              multiple systems, teams can verify against a governed history.
            </p>
          </div>
          <div className="md:col-span-7">
            <p className="text-[10px] tracking-[0.22em] uppercase text-white/45 mb-4">
              Included outputs
            </p>
            <ul className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden">
              {[
                "Ownership history and current register views",
                "Document provenance and anchored references",
                "Capital activity and settlement support",
                "Transfer and approval history",
                "Reporting and investor-facing packages",
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
  return (
    <section className="relative py-24 md:py-32 border-t border-white/10">
      <div className="mx-auto max-w-5xl px-6 md:px-10 text-center">
        <p className="text-xs tracking-[0.22em] uppercase text-white/45 mb-5">
          Privacy and control
        </p>
        <h3 className="font-serif font-light text-3xl md:text-5xl leading-[1.1] text-white tracking-[-0.02em]">
          Selective visibility, not broad disclosure.
        </h3>
        <p className="mt-6 mx-auto max-w-2xl text-white/60 text-[15px] leading-relaxed">
          Role-based access, controlled document handling, and auditability without unnecessary exposure.
        </p>
        <div className="mt-8">
          <Link
            to="/privacy"
            className="inline-flex items-center gap-2 text-white/85 border border-white/20 hover:border-white/40 px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
          >
            Read the full Privacy &amp; Control notice
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function MockPanel({
  label,
  icon,
  title,
  subtitle,
  children,
  dense,
}: {
  label: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
      <div className="flex items-start justify-between px-4 pt-4">
        <div>
          <p className="text-[10px] tracking-[0.22em] uppercase text-white/40 mb-1 flex items-center gap-1.5">
            {icon} {label}
          </p>
          <h4 className="text-white text-lg font-medium">{title}</h4>
          <p className={`text-white/55 text-sm mt-1 ${dense ? "max-w-md" : ""}`}>{subtitle}</p>
        </div>
      </div>
      <div className={dense ? "mt-3" : "mt-4"}>{children}</div>
    </div>
  );
}

/* ── CLOSING + FOOTER ─────────────────────────────────────────────────── */

function ClosingAndFooter() {
  return (
    <>
      <section className="relative py-28 md:py-40 border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 md:px-10 text-center">
          <p className="text-xs tracking-[0.22em] uppercase text-white/50 mb-6">
            Angainor
          </p>
          <h3 className="font-serif font-light text-4xl md:text-6xl leading-[1.05] text-white tracking-[-0.02em]">
            Angainor. <br className="hidden sm:block" />
            <span className="italic">The infrastructure revolutionizing fund operations.</span>
          </h3>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href={DEMO_CTA}
              className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Request a conversation
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={DESIGN_PARTNER_CTA}
              className="inline-flex items-center gap-2 text-white/90 border border-white/20 hover:border-white/40 px-6 py-3 rounded-full text-sm font-medium transition-colors"
            >
              Become a design partner
            </a>
          </div>
          {/* DLT caption — tucked small, muted, above footer per spec preservation */}
          <p className="mt-16 text-[11px] tracking-[0.18em] uppercase text-white/35">
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
                { t: "Workflows", h: "#what-angainor-does" },
                { t: "Privacy & Control", h: "/privacy", internal: true },
              ]}
            />
            <FooterGroup
              title="Company"
              links={[
                { t: "Design Partners", h: DESIGN_PARTNER_CTA },
                { t: "Contact", h: DEMO_CTA },
              ]}
            />
            <FooterGroup
              title="Access"
              links={[
                { t: "Sign in", h: "/login", internal: true },
                { t: "Book a Demo", h: DEMO_CTA },
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

function FooterGroup({
  title,
  links,
}: {
  title: string;
  links: { t: string; h: string; internal?: boolean }[];
}) {
  return (
    <div>
      <h5 className="text-[10px] tracking-[0.22em] uppercase text-white/40 mb-4">{title}</h5>
      <ul className="space-y-2.5">
        {links.map((l) =>
          l.internal ? (
            <li key={l.t}>
              <Link to={l.h} className="text-white/70 hover:text-white transition-colors">
                {l.t}
              </Link>
            </li>
          ) : (
            <li key={l.t}>
              <a href={l.h} className="text-white/70 hover:text-white transition-colors">
                {l.t}
              </a>
            </li>
          )
        )}
      </ul>
    </div>
  );
}

/* ── ROOT ─────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div
      className="min-h-screen bg-black text-white ang-animated"
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <NavBar />
      <main>
        <Hero />
        <ProblemSection />
        {/* <WhatAngainorDoes />  // hidden by request */}
        <WorkflowCoverage />
        <AuditCompliance />
        <PrivacyAndControl />
        <ClosingAndFooter />
      </main>
    </div>
  );
}
