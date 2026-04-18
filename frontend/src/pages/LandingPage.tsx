import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Database,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Check,
} from "lucide-react";

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

const SOURCE_RECORDS = [
  { label: "Admin system", sub: "Fund admin platform", x: 60, y: 120, anim: "ang-float-a" },
  { label: "Counsel docs", sub: "LPA, side letters, amendments", x: 620, y: 120, anim: "ang-float-b" },
  { label: "Spreadsheets", sub: "Cap tables and trackers", x: 40, y: 300, anim: "ang-float-c" },
  { label: "Email approvals", sub: "Manual signoff chain", x: 640, y: 300, anim: "ang-float-d" },
  { label: "Bank evidence", sub: "Wire confirmations and receipts", x: 60, y: 480, anim: "ang-float-b" },
  { label: "LP materials", sub: "Notices, statements, reports", x: 620, y: 480, anim: "ang-float-a" },
];

function ProblemMockup() {
  return (
    <div className="relative mx-auto w-full max-w-5xl rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
      {/* Top meta */}
      <div className="relative flex items-center justify-between px-5 pt-4 text-[10px] tracking-[0.18em] uppercase text-white/40">
        <span>Visual intent</span>
        <span className="hidden sm:inline">Current operating reality</span>
      </div>
      {/* SVG diagram */}
      <div className="relative">
        <svg
          viewBox="0 0 900 640"
          className="w-full h-auto ang-animated"
          role="img"
          aria-label="Six disconnected source systems are reconstructed into a temporary fund truth"
        >
          <defs>
            <linearGradient id="ang-connector" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {/* Connector lines — curving toward center */}
          {SOURCE_RECORDS.map((r, i) => {
            const cx = 450;
            const cy = 320;
            const startX = r.x + 130;
            const startY = r.y + 45;
            const midX = (startX + cx) / 2;
            const midY = (startY + cy) / 2 + (i % 2 === 0 ? -20 : 20);
            return (
              <path
                key={i}
                d={`M ${startX} ${startY} Q ${midX} ${midY} ${cx} ${cy}`}
                fill="none"
                stroke="url(#ang-connector)"
                strokeWidth="1"
                strokeDasharray="4 4"
                style={{
                  animation: `ang-dash 6s linear infinite`,
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            );
          })}
          {/* Source record cards */}
          {SOURCE_RECORDS.map((r, i) => (
            <g
              key={`card-${i}`}
              style={{
                animation: `${r.anim} ${7 + (i % 3)}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
                transformOrigin: `${r.x + 130}px ${r.y + 40}px`,
              }}
            >
              <rect
                x={r.x}
                y={r.y}
                width={260}
                height={80}
                rx={10}
                fill="#0a0a0a"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1"
              />
              <circle cx={r.x + 18} cy={r.y + 22} r={3} fill="#ffffff" />
              <text
                x={r.x + 30}
                y={r.y + 26}
                fill="rgba(255,255,255,0.45)"
                fontSize="9"
                fontFamily="Inter, system-ui, sans-serif"
                letterSpacing="1.8"
              >
                SOURCE RECORD
              </text>
              <text
                x={r.x + 18}
                y={r.y + 48}
                fill="#ffffff"
                fontSize="16"
                fontWeight="600"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {r.label}
              </text>
              <text
                x={r.x + 18}
                y={r.y + 66}
                fill="rgba(255,255,255,0.55)"
                fontSize="12"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {r.sub}
              </text>
            </g>
          ))}
          {/* Coordination labels */}
          <rect x={295} y={175} width={310} height={26} rx={13} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" />
          <text
            x={450}
            y={192}
            textAnchor="middle"
            fill="rgba(255,255,255,0.6)"
            fontSize="11"
            fontFamily="Inter, system-ui, sans-serif"
          >
            Cross-system handoffs and parallel updates
          </text>
          <rect x={355} y={450} width={190} height={26} rx={13} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" />
          <text
            x={450}
            y={467}
            textAnchor="middle"
            fill="rgba(255,255,255,0.6)"
            fontSize="11"
            fontFamily="Inter, system-ui, sans-serif"
          >
            Manual reconciliation layer
          </text>
          {/* Central "Temporary truth" card */}
          <g>
            <rect
              x={325}
              y={220}
              width={250}
              height={210}
              rx={12}
              fill="#000000"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="1"
            />
            <text
              x={345}
              y={246}
              fill="rgba(255,255,255,0.45)"
              fontSize="9"
              letterSpacing="1.8"
              fontFamily="Inter, system-ui, sans-serif"
            >
              CURRENT OPERATING
            </text>
            <text
              x={345}
              y={258}
              fill="rgba(255,255,255,0.45)"
              fontSize="9"
              letterSpacing="1.8"
              fontFamily="Inter, system-ui, sans-serif"
            >
              REALITY
            </text>
            {/* "Reconstructed" — de-pilled: small-caps text, no pill background */}
            <text
              x={555}
              y={250}
              textAnchor="end"
              fill="rgba(255,255,255,0.55)"
              fontSize="9"
              letterSpacing="1.8"
              fontFamily="Inter, system-ui, sans-serif"
            >
              RECONSTRUCTED
            </text>
            <text
              x={345}
              y={290}
              fill="#ffffff"
              fontSize="20"
              fontWeight="500"
              fontFamily="Fraunces, serif"
            >
              Temporary truth
            </text>
            <text x={345} y={312} fill="rgba(255,255,255,0.55)" fontSize="10.5" fontFamily="Inter, system-ui, sans-serif">
              <tspan x={345} dy="0">The fund state is assembled on demand</tspan>
              <tspan x={345} dy="13">from partial records rather than maintained</tspan>
              <tspan x={345} dy="13">natively in one governed system.</tspan>
            </text>
            {/* Inner tag grid */}
            {[
              ["ownership state", "capital activity"],
              ["transfer approvals", "reporting inputs"],
              ["settlement status", "audit support"],
            ].map((row, ri) =>
              row.map((t, ci) => (
                <g key={`tag-${ri}-${ci}`}>
                  <rect
                    x={345 + ci * 100}
                    y={358 + ri * 22}
                    width={92}
                    height={18}
                    rx={4}
                    fill="rgba(255,255,255,0.04)"
                    stroke="rgba(255,255,255,0.12)"
                  />
                  <text
                    x={345 + ci * 100 + 46}
                    y={371 + ri * 22}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.75)"
                    fontSize="9.5"
                    fontFamily="Inter, system-ui, sans-serif"
                  >
                    {t}
                  </text>
                </g>
              ))
            )}
          </g>
        </svg>
      </div>
      {/* Legend */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 pb-4 text-[10px] tracking-[0.14em] uppercase text-white/35">
        <span>Visual intent</span>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-5 bg-white/50" /> Primary dependency
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-5 border-t border-dashed border-white/40" /> Lateral handoff
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> Record source
          </span>
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

const WORKFLOWS = [
  "Fund formation and governing documents",
  "Investor onboarding and subscriptions",
  "Capital calls and settlement validation",
  "Cap table and ownership maintenance",
  "Transfers",
  "Distributions and waterfall support",
  "Reporting",
  "Audit and exports",
];

function WorkflowCoverage() {
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) {
        setActive((a) => (a + 1) % WORKFLOWS.length);
      }
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="flex items-baseline gap-4 mb-8">
          <span className="font-mono text-5xl md:text-6xl text-white/25 tracking-[-0.02em] leading-none">
            08
          </span>
          <h3 className="font-serif font-light text-4xl md:text-5xl leading-[1.1] text-white tracking-[-0.015em]">
            One operating layer across the fund lifecycle.
          </h3>
        </div>
        <ul
          className="mt-8 space-y-2 md:space-y-3"
          onMouseEnter={pause}
          onMouseLeave={resume}
          onFocus={pause}
          onBlur={resume}
          aria-live="polite"
        >
          {WORKFLOWS.map((w, i) => {
            const isActive = i === active;
            return (
              <li key={w}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className="w-full text-left flex items-baseline gap-5 py-2 focus:outline-none focus:ring-1 focus:ring-white/30 rounded-md"
                >
                  <span
                    className={`font-mono text-xs tabular-nums transition-colors ${
                      isActive ? "text-white/70" : "text-white/20"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`font-serif font-light text-2xl md:text-4xl leading-[1.15] tracking-[-0.015em] transition-colors duration-500 ${
                      isActive ? "text-white" : "text-white/25"
                    }`}
                  >
                    {w}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
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
            <div className="relative grid md:grid-cols-3 gap-4 md:gap-0">
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
              {/* Connector */}
              <Connector side="left" highlight={hover !== null} />
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
                showArrow
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
  showArrow,
}: {
  index: 0 | 1 | 2;
  active: 0 | 1 | 2 | null;
  onHover: (i: 0 | 1 | 2 | null) => void;
  label: string;
  title: string;
  value: string;
  rows: { k: string; v: string; mono?: boolean; pulse?: boolean }[];
  showArrow?: boolean;
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
      {showArrow && (
        <div
          className={`mt-4 inline-flex items-center gap-1.5 text-[11px] text-white/60 transition-opacity ${
            isActive ? "opacity-100" : "opacity-0"
          }`}
        >
          View source
          <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}

function Connector({ side, highlight }: { side: "left" | "right"; highlight: boolean }) {
  // Visible only on desktop — absolutely positioned flourish
  return (
    <div
      aria-hidden
      className={`hidden md:flex absolute top-1/2 -translate-y-1/2 items-center ${
        side === "left" ? "left-1/3" : "right-1/3"
      }`}
      style={{ left: side === "left" ? "33.333%" : undefined, right: side === "right" ? "33.333%" : undefined }}
    >
      <svg width="60" height="24" viewBox="0 0 60 24" fill="none">
        <path
          d="M 0 12 L 54 12"
          stroke={highlight ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)"}
          strokeWidth="1"
          strokeDasharray="4 4"
          style={{ animation: highlight ? "ang-dash 1.5s linear infinite" : "none" }}
        />
        <path
          d={`M 52 6 L 58 12 L 52 18`}
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
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid md:grid-cols-12 gap-10 md:gap-12 items-start">
          <div className="md:col-span-5 md:sticky md:top-24">
            <p className="text-xs tracking-[0.22em] uppercase text-white/45 mb-4">
              Privacy and control
            </p>
            <h3 className="font-serif font-light text-4xl md:text-5xl leading-[1.05] text-white tracking-[-0.02em]">
              Selective visibility, <br /> not broad disclosure.
            </h3>
            <p className="mt-6 text-white/65 text-[15px] leading-relaxed">
              Angainor is designed so the full fund record is not broadcast everywhere. Raw source
              documents remain in controlled storage. What gets anchored is the hash, timestamp,
              document reference, state transition, and ownership event needed for integrity and
              provenance, not the full confidential file body.
            </p>
            <div className="mt-8 space-y-3">
              {[
                {
                  t: "Role-based visibility",
                  d: "GPs and administrators can access the operational record they need. LPs see only their own position, notices, documents, and capital-account context.",
                },
                {
                  t: "Controlled document handling",
                  d: "Full confidential source files remain in controlled storage rather than being exposed as open ledger content.",
                },
                {
                  t: "Auditability without unnecessary exposure",
                  d: "Traceability is preserved while disclosure stays tightly limited to what each role actually needs.",
                },
              ].map((p) => (
                <div key={p.t} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </span>
                    <div>
                      <h4 className="text-white text-sm font-medium">{p.t}</h4>
                      <p className="text-white/55 text-sm mt-1 leading-relaxed">{p.d}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Right: 3 panels aligned to the 3 left-rail principles */}
          <div className="md:col-span-7 space-y-4">
            {/* Panel 1 — Role-based visibility: blurred Other participants */}
            <MockPanel label="View" icon={<EyeOff className="h-3.5 w-3.5" />} title="Other participants" subtitle="No unnecessary disclosure of another LP's full records." dense>
              <div className="relative p-3">
                <div className="grid grid-cols-2 gap-2 blur-[3px] opacity-60 select-none pointer-events-none">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-8 rounded border border-white/10 bg-white/[0.02]" />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] tracking-[0.22em] uppercase text-white/55 bg-black/60 border border-white/10 rounded-full px-3 py-1">
                    Access denied outside role scope
                  </span>
                </div>
              </div>
            </MockPanel>

            {/* Panel 2 — Controlled document handling */}
            <MockPanel label="View" icon={<Lock className="h-3.5 w-3.5" />} title="Controlled storage" subtitle="Source files remain in managed document storage.">
              <ul className="divide-y divide-white/8">
                {[
                  "Executed LPA.pdf",
                  "Subscription package.zip",
                  "Side letter.pdf",
                  "Bank confirmation.pdf",
                ].map((f) => (
                  <li key={f} className="flex items-center justify-between px-4 py-2.5 text-sm text-white/80">
                    <span className="flex items-center gap-2.5">
                      <FileText className="h-3.5 w-3.5 text-white/45" />
                      {f}
                    </span>
                    <span className="text-[10px] tracking-[0.18em] text-white/55 border border-white/15 rounded-full px-2 py-0.5">
                      PRIVATE
                    </span>
                  </li>
                ))}
              </ul>
            </MockPanel>

            {/* Panel 3 — Auditability without unnecessary exposure */}
            <MockPanel label="View" icon={<Database className="h-3.5 w-3.5" />} title="Anchored record" subtitle="Only the governed integrity layer is recorded and used operationally.">
              <ul className="divide-y divide-white/8">
                {["Hash", "Timestamp", "Document ref", "State transition", "Ownership event"].map((k) => (
                  <li key={k} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-white/80">{k}</span>
                    <span className="text-[10px] tracking-[0.18em] text-white/55 border border-white/15 rounded-full px-2 py-0.5">
                      ANCHORED
                    </span>
                  </li>
                ))}
              </ul>
            </MockPanel>
          </div>
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
              links={[{ t: "Workflows", h: "#what-angainor-does" }]}
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
        <WhatAngainorDoes />
        <WorkflowCoverage />
        <AuditCompliance />
        <PrivacyAndControl />
        <ClosingAndFooter />
      </main>
    </div>
  );
}
