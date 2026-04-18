import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  EyeOff,
  FileText,
  Lock,
} from "lucide-react";

const DEMO_CTA =
  "mailto:founders@angainor.io?subject=Angainor%20%E2%80%94%20Demo%20Request";
const PRIVACY_CONTACT =
  "mailto:privacy@angainor.io?subject=Angainor%20%E2%80%94%20Privacy%20Request";

const EFFECTIVE_DATE = "April 18, 2026";
const LAST_UPDATED = "April 18, 2026";

const TOC: { id: string; n: string; title: string }[] = [
  { id: "overview", n: "01", title: "Overview" },
  { id: "principles", n: "02", title: "Design principles" },
  { id: "data", n: "03", title: "Data we collect" },
  { id: "controlled-vs-anchored", n: "04", title: "Controlled vs anchored data" },
  { id: "legal-basis", n: "05", title: "Legal basis for processing" },
  { id: "role-based-access", n: "06", title: "Role-based access" },
  { id: "retention", n: "07", title: "Retention & deletion" },
  { id: "rights", n: "08", title: "Your rights" },
  { id: "transfers", n: "09", title: "International transfers" },
  { id: "sub-processors", n: "10", title: "Sub-processors" },
  { id: "security", n: "11", title: "Security measures" },
  { id: "incident-response", n: "12", title: "Incident response" },
  { id: "children", n: "13", title: "Children's data" },
  { id: "changes", n: "14", title: "Changes to this notice" },
  { id: "contact", n: "15", title: "Contact & governing law" },
];

function PrivacyNav() {
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
            to="/"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
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

function Section({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="relative scroll-mt-24">
      <div className="grid md:grid-cols-12 gap-8 md:gap-12 py-12 md:py-14 border-t border-white/10">
        <div className="md:col-span-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-xs text-white/35 tabular-nums">
              § {index}
            </span>
            <h2 className="font-serif font-light text-2xl md:text-3xl text-white leading-[1.15] tracking-[-0.015em]">
              {title}
            </h2>
          </div>
        </div>
        <div className="md:col-span-8 space-y-4 text-[15px] leading-relaxed text-white/70">
          {children}
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

function PrivacyShowcase() {
  const principles = [
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
  ];
  return (
    <section className="relative py-20 md:py-28 border-b border-white/10">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid md:grid-cols-12 gap-10 md:gap-12 items-start">
          {/* Left: sticky rail */}
          <div className="md:col-span-5 md:sticky md:top-24">
            <p className="text-xs tracking-[0.22em] uppercase text-white/45 mb-4">
              How it works
            </p>
            <h2 className="font-serif font-light text-3xl md:text-4xl leading-[1.05] text-white tracking-[-0.02em]">
              Three guarantees, designed into the system.
            </h2>
            <p className="mt-6 text-white/65 text-[15px] leading-relaxed">
              Angainor is designed so the full fund record is not broadcast everywhere. Raw source documents remain in controlled storage. What gets anchored is the hash, timestamp, document reference, state transition, and ownership event needed for integrity and provenance — not the full confidential file body.
            </p>
            <div className="mt-8 space-y-3">
              {principles.map((p) => (
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
          {/* Right: 3 mockup panels */}
          <div className="md:col-span-7 space-y-4">
            <MockPanel
              label="View"
              icon={<EyeOff className="h-3.5 w-3.5" />}
              title="Other participants"
              subtitle="No unnecessary disclosure of another LP's full records."
              dense
            >
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

            <MockPanel
              label="View"
              icon={<Lock className="h-3.5 w-3.5" />}
              title="Controlled storage"
              subtitle="Source files remain in managed document storage."
            >
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

            <MockPanel
              label="View"
              icon={<Database className="h-3.5 w-3.5" />}
              title="Anchored record"
              subtitle="Only the governed integrity layer is recorded and used operationally."
            >
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

function DL({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="rounded-xl border border-white/10 overflow-hidden">
      {rows.map(([k, v], i) => (
        <div
          key={k}
          className={`grid grid-cols-1 sm:grid-cols-12 gap-3 px-5 py-4 bg-white/[0.015] ${
            i < rows.length - 1 ? "border-b border-white/8" : ""
          }`}
        >
          <dt className="sm:col-span-4 text-[11px] tracking-[0.18em] uppercase text-white/45">
            {k}
          </dt>
          <dd className="sm:col-span-8 text-white/80">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PrivacyAndControlPage() {
  return (
    <div
      className="min-h-screen bg-black text-white"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <style>{`
        .font-serif { font-family: Fraunces, 'Times New Roman', serif; }
        .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
      `}</style>
      <PrivacyNav />

      {/* Hero */}
      <section className="relative pt-40 pb-16 md:pt-48 md:pb-20 border-b border-white/10">
        <div className="mx-auto max-w-5xl px-6 md:px-10">
          <p className="text-xs tracking-[0.22em] uppercase text-white/50 mb-6">
            Privacy & control
          </p>
          <h1 className="font-serif font-light text-4xl md:text-6xl text-white leading-[1.05] tracking-[-0.02em]">
            Selective visibility,
            <br className="hidden md:block" />
            <span className="italic font-normal"> not broad disclosure.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-base md:text-lg text-white/65 leading-relaxed">
            This notice explains how Angainor collects, uses, anchors, retains,
            and permits access to personal and operational data in connection
            with private real estate fund administration services.
          </p>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-[11px] tracking-[0.18em] uppercase text-white/45">
            <span>
              Effective <span className="text-white/70">{EFFECTIVE_DATE}</span>
            </span>
            <span>
              Last updated <span className="text-white/70">{LAST_UPDATED}</span>
            </span>
            <span>
              Version <span className="text-white/70 font-mono normal-case">v1.0</span>
            </span>
          </div>
        </div>
      </section>

      {/* Showcase — original home-page split layout, moved here */}
      <PrivacyShowcase />

      {/* Table of contents */}
      <section className="relative py-10 md:py-14">
        <div className="mx-auto max-w-5xl px-6 md:px-10">
          <p className="text-[10px] tracking-[0.22em] uppercase text-white/40 mb-5">
            Contents
          </p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2.5 text-sm">
            {TOC.map((t) => (
              <li key={t.id} className="flex items-baseline gap-3">
                <span className="font-mono text-[10px] text-white/35 tabular-nums w-5">
                  {t.n}
                </span>
                <a
                  href={`#${t.id}`}
                  className="text-white/70 hover:text-white transition-colors border-b border-transparent hover:border-white/40 pb-px"
                >
                  {t.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-6 md:px-10 pb-24">
        <Section id="overview" index="01" title="Overview">
          <p>
            Angainor (&quot;<strong>Angainor</strong>,&quot; &quot;<strong>we</strong>,&quot; &quot;<strong>our</strong>&quot;) provides
            fund-native operating infrastructure to private real estate fund
            managers (each a &quot;<strong>Customer</strong>&quot;). Customers use Angainor to
            administer their funds, maintain cap tables, validate settlement,
            execute transfers, generate reports, and produce audit-ready
            records.
          </p>
          <p>
            This notice describes how Angainor processes personal data both as
            a <strong>data processor</strong> (acting on Customer instructions in
            respect of their limited partners and authorized users) and as a
            <strong> data controller</strong> (in respect of our direct commercial
            relationships, marketing, and website operation).
          </p>
          <p>
            Where Angainor acts as processor, the Customer remains the
            controller of personal data concerning its limited partners,
            investors, and investors&apos; representatives. Customer-specific data
            processing terms are set out in the Customer&apos;s executed Data
            Processing Addendum (&quot;DPA&quot;), which prevails over this notice to
            the extent of any conflict.
          </p>
        </Section>

        <Section id="principles" index="02" title="Design principles">
          <p>
            Angainor&apos;s privacy posture reflects four design principles,
            codified in our architecture rather than stated as aspirations:
          </p>
          <ul className="space-y-3 list-none pl-0">
            <li className="rounded-lg border border-white/10 bg-white/[0.015] p-4">
              <span className="block text-white font-medium">
                1. Selective visibility, not broad disclosure.
              </span>
              <span className="text-white/60 text-sm mt-1 block">
                The full fund record is not broadcast everywhere. Raw source
                documents remain in controlled storage.
              </span>
            </li>
            <li className="rounded-lg border border-white/10 bg-white/[0.015] p-4">
              <span className="block text-white font-medium">
                2. Anchor integrity, not confidential content.
              </span>
              <span className="text-white/60 text-sm mt-1 block">
                What is anchored to distributed ledger is the
                <em> hash, timestamp, document reference, state transition,
                and ownership event</em> needed for provenance — not the
                underlying file body.
              </span>
            </li>
            <li className="rounded-lg border border-white/10 bg-white/[0.015] p-4">
              <span className="block text-white font-medium">
                3. Role-based operational scope.
              </span>
              <span className="text-white/60 text-sm mt-1 block">
                GPs and administrators see the operational record they need to
                run the fund. LPs see only their own position, notices,
                documents, and capital-account context.
              </span>
            </li>
            <li className="rounded-lg border border-white/10 bg-white/[0.015] p-4">
              <span className="block text-white font-medium">
                4. Auditability without unnecessary exposure.
              </span>
              <span className="text-white/60 text-sm mt-1 block">
                Traceability is preserved while disclosure stays limited to
                what each role actually needs.
              </span>
            </li>
          </ul>
        </Section>

        <Section id="data" index="03" title="Data we collect">
          <p>
            The categories of data we collect depend on the role in which we
            act. Categories are listed below. Specific fields and sources vary
            by Customer configuration.
          </p>
          <p className="text-white font-medium pt-2">
            Identity &amp; compliance data (controller: Customer)
          </p>
          <ul className="list-disc pl-5 space-y-1 text-white/65">
            <li>Full legal name, date of birth, nationality, jurisdiction of residence</li>
            <li>Government-issued identifiers where required by AML/KYC regulation</li>
            <li>Accreditation / qualified purchaser status and supporting evidence</li>
            <li>Source of funds / source of wealth attestations</li>
            <li>Tax residency and withholding-related identifiers (e.g. TIN, W-8/W-9 form data)</li>
            <li>Sanctions, PEP, and adverse-media screening results</li>
          </ul>
          <p className="text-white font-medium pt-2">
            Operational &amp; financial data (controller: Customer)
          </p>
          <ul className="list-disc pl-5 space-y-1 text-white/65">
            <li>Subscription amounts, capital commitments, and call schedules</li>
            <li>Bank wire evidence uploaded in support of settlement</li>
            <li>Wallet addresses linked by the investor for eligible funds</li>
            <li>Ownership state, transfer history, distribution history</li>
            <li>Document metadata (filename, size, MIME type, cryptographic hash, timestamp)</li>
          </ul>
          <p className="text-white font-medium pt-2">
            Platform &amp; account data (controller: Angainor)
          </p>
          <ul className="list-disc pl-5 space-y-1 text-white/65">
            <li>Account registration details for authorized users (email, role, organization)</li>
            <li>Authentication tokens and session metadata</li>
            <li>Audit logs of access, document views, exports, and administrative actions</li>
            <li>Application telemetry: requests, response codes, error traces (no user input payloads)</li>
          </ul>
          <p className="text-white font-medium pt-2">
            Website &amp; commercial data (controller: Angainor)
          </p>
          <ul className="list-disc pl-5 space-y-1 text-white/65">
            <li>Contact details submitted via demo-request or partnership inquiries</li>
            <li>Basic analytics about visits to angainor.io (coarse, aggregated)</li>
          </ul>
          <p className="pt-2 text-white/55 text-sm">
            We do not knowingly collect sensitive categories of data (e.g.
            health, biometric identifiers, political opinions) except where
            unavoidable for AML/KYC (e.g. a photograph embedded in an
            identity document).
          </p>
        </Section>

        <Section
          id="controlled-vs-anchored"
          index="04"
          title="Controlled vs anchored data"
        >
          <p>
            Angainor separates confidential content from integrity anchors.
            This separation is a privacy feature, not a performance
            optimization.
          </p>
          <DL
            rows={[
              [
                "Controlled storage",
                <>
                  Executed LPAs, side letters, bank confirmations, subscription
                  packages, tax forms, and similar <strong>confidential source
                  files</strong> remain in managed, access-controlled storage. They
                  are <strong>not</strong> published to any distributed ledger in plaintext,
                  hashed form, or otherwise.
                </>,
              ],
              [
                "Anchored record",
                <>
                  What is written to distributed ledger is the{" "}
                  <strong>integrity anchor</strong>: cryptographic hash of the
                  source document, timestamp of anchoring, an opaque document
                  reference, the resulting state transition, and the ownership
                  event (where applicable). The anchor permits any party with
                  the original file to prove integrity without disclosing
                  content.
                </>,
              ],
              [
                "What is not anchored",
                <>
                  Personal identifiers, financial figures tied to individuals,
                  narrative clauses from source documents, and any other
                  payload that would expose private content.
                </>,
              ],
            ]}
          />
        </Section>

        <Section id="legal-basis" index="05" title="Legal basis for processing">
          <p>
            For personal data to which the GDPR, UK GDPR, or materially similar
            legislation applies, Angainor processes personal data under the
            following legal bases:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-white/65">
            <li>
              <strong className="text-white/85">Performance of a contract</strong> — to provide the
              services to our Customers and to their authorized users.
            </li>
            <li>
              <strong className="text-white/85">Legal obligation</strong> — to meet AML, sanctions,
              tax, and audit obligations applicable to us or to our Customer.
            </li>
            <li>
              <strong className="text-white/85">Legitimate interests</strong> — to secure our
              platform, prevent abuse, maintain audit trails, and operate our
              business. Where we rely on this basis we balance it against your
              rights and freedoms.
            </li>
            <li>
              <strong className="text-white/85">Consent</strong> — where required, for example for
              marketing communications, which you can withdraw at any time.
            </li>
          </ul>
          <p>
            For data to which the CCPA/CPRA applies, Angainor does not sell or
            share personal information as those terms are defined under
            California law. Angainor has not sold personal information in the
            preceding twelve months and has no plans to do so.
          </p>
        </Section>

        <Section id="role-based-access" index="06" title="Role-based access">
          <p>
            Access to data inside Angainor is governed by role. No role has
            access beyond what is necessary for its function.
          </p>
          <DL
            rows={[
              [
                "GP / fund administrator",
                "Operational visibility across the records they need to run the fund: ownership state, notice matrix, settlement status, capital accounts, distribution history.",
              ],
              [
                "LP / investor",
                "Only their own position, notices, documents, and capital-account context. No visibility into other LPs' records.",
              ],
              [
                "Operations analyst",
                "Read access scoped to assigned funds; no destructive actions without dual-control where configured.",
              ],
              [
                "Angainor support",
                "Access only on Customer request or incident response. All support access is logged and surfaced in the Customer's audit log.",
              ],
              [
                "Other participants",
                "No disclosure of another LP's full records under any role.",
              ],
            ]}
          />
        </Section>

        <Section id="retention" index="07" title="Retention and deletion">
          <p>
            Angainor retains personal data for as long as the Customer
            maintains its account and for such additional periods as are
            required to comply with legal, regulatory, accounting, audit, or
            dispute-resolution obligations.
          </p>
          <p>Specific retention periods (illustrative):</p>
          <ul className="list-disc pl-5 space-y-1.5 text-white/65">
            <li>
              <strong className="text-white/85">AML/KYC records</strong> — at least 5 years after
              end of the investor relationship, per applicable regulation;
              often longer where required.
            </li>
            <li>
              <strong className="text-white/85">Capital-account &amp; tax records</strong> — 7 years
              following the end of the applicable tax year, or longer per
              jurisdiction.
            </li>
            <li>
              <strong className="text-white/85">Audit logs</strong> — 7 years minimum.
            </li>
            <li>
              <strong className="text-white/85">Marketing contacts</strong> — until consent is
              withdrawn or after 24 months of inactivity.
            </li>
          </ul>
          <p>
            <strong>On-chain anchors are immutable.</strong> Cryptographic hashes, timestamps,
            and ownership events written to a distributed ledger cannot be
            deleted. They reveal no personal data on their own, and the
            underlying source files they attest to remain deletable from
            controlled storage. Upon a valid erasure request we delete the
            underlying content; the anchor remains as a neutral mathematical
            reference that is no longer resolvable to personal data.
          </p>
        </Section>

        <Section id="rights" index="08" title="Your rights">
          <p>
            Depending on your jurisdiction, you may have some or all of the
            following rights in respect of your personal data:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-white/65">
            <li>Right of access to personal data we hold about you</li>
            <li>Right to rectification of inaccurate or incomplete data</li>
            <li>Right to erasure (&quot;right to be forgotten&quot;) subject to legal retention requirements</li>
            <li>Right to restrict or object to certain processing</li>
            <li>Right to data portability in a structured, commonly used, machine-readable format</li>
            <li>Right to lodge a complaint with a supervisory authority</li>
            <li>Right to withdraw consent where processing is based on consent</li>
            <li>
              For California residents: rights to know, delete, correct, and
              limit the use of sensitive personal information, and the right
              to non-discrimination for exercising these rights
            </li>
          </ul>
          <p>
            Where Angainor acts as processor for a Customer, we will forward
            your request to the Customer (who is the controller) and assist
            them in responding. Where Angainor acts as controller, we will
            respond directly within the timeframes required by law (generally
            30 days).
          </p>
          <p>
            To exercise a right, email{" "}
            <a href={PRIVACY_CONTACT} className="text-white/90 underline underline-offset-4 hover:text-white">
              privacy@angainor.io
            </a>
            . Please include enough detail for us to identify you and locate
            your data. We may need to verify your identity before acting on a
            request.
          </p>
        </Section>

        <Section id="transfers" index="09" title="International transfers">
          <p>
            Angainor operates infrastructure in the United States and may
            transfer personal data to, and process personal data in, the
            United States or other jurisdictions where our Customers, their
            limited partners, sub-processors, or regulators are located.
          </p>
          <p>
            Where we transfer personal data out of the European Economic Area,
            the United Kingdom, or Switzerland, we rely on the European
            Commission&apos;s Standard Contractual Clauses (SCCs), the UK
            International Data Transfer Addendum, or an equivalent mechanism,
            combined with supplementary measures where necessary.
          </p>
        </Section>

        <Section id="sub-processors" index="10" title="Sub-processors">
          <p>
            Angainor engages vetted sub-processors to deliver the service.
            Current sub-processor categories include:
          </p>
          <DL
            rows={[
              [
                "Cloud infrastructure",
                "Application hosting, serverless compute, edge delivery.",
              ],
              [
                "Managed database",
                "Primary data store for operational records and audit logs.",
              ],
              [
                "Identity & authentication",
                "Third-party authentication provider for account login.",
              ],
              [
                "Document storage",
                "Object storage for confidential source files; access-controlled, encrypted at rest.",
              ],
              [
                "Distributed ledger",
                "Public test or permissioned network used only for integrity anchors, never for personal or confidential content.",
              ],
              [
                "Email delivery",
                "Transactional email for notices and system messages.",
              ],
              [
                "Customer support",
                "Ticketing and incident management.",
              ],
            ]}
          />
          <p>
            The current specific list of named sub-processors is available on
            request to{" "}
            <a href={PRIVACY_CONTACT} className="text-white/90 underline underline-offset-4 hover:text-white">
              privacy@angainor.io
            </a>{" "}
            and is maintained in our DPA as a living annex. Customers are
            notified of material additions in accordance with the DPA.
          </p>
        </Section>

        <Section id="security" index="11" title="Security measures">
          <ul className="list-disc pl-5 space-y-1.5 text-white/65">
            <li>TLS 1.2+ in transit; AES-256 at rest for document storage and backups</li>
            <li>Application-level authorization on every request; role-scoped DB queries</li>
            <li>Non-custodial wallet design — no investor private keys are stored on our servers</li>
            <li>Least-privilege production access, enforced via identity provider + MFA</li>
            <li>Secrets managed through a sealed secret store, not source code</li>
            <li>Continuous logging of authentication, access, and administrative events</li>
            <li>Vulnerability scanning on dependencies and container images</li>
            <li>Quarterly third-party penetration testing (as we mature into production deployments)</li>
            <li>Separation of production and non-production environments with no real Customer data in non-production</li>
          </ul>
        </Section>

        <Section id="incident-response" index="12" title="Incident response">
          <p>
            Angainor maintains a written incident-response procedure. Suspected
            personal-data breaches are triaged by our on-call team within one
            hour of detection, contained within four hours where feasible, and
            notified to affected Customers without undue delay and in any
            event within seventy-two (72) hours where required by applicable
            law.
          </p>
          <p>
            Customers notify their own data subjects and regulators in
            accordance with their own obligations. Angainor assists Customers
            with forensic detail, audit log extracts, and regulator
            correspondence as required.
          </p>
        </Section>

        <Section id="children" index="13" title="Children's data">
          <p>
            Angainor is a business-to-business service used by professional
            investors and fund administrators. Our service is not directed to
            children under 16, and we do not knowingly collect personal data
            from children. If you believe a child has provided personal data
            to us, please contact us and we will take prompt steps to delete
            it.
          </p>
        </Section>

        <Section id="changes" index="14" title="Changes to this notice">
          <p>
            We may update this notice from time to time. Material changes will
            be communicated through the service and/or by email to account
            administrators with at least 30 days&apos; notice before the change
            takes effect. The &quot;Last updated&quot; date at the top of this notice
            reflects the most recent revision.
          </p>
          <p>
            Prior versions are available on request. Continued use of the
            service after the effective date of an updated notice constitutes
            acceptance of the updated terms, to the extent permitted by law.
          </p>
        </Section>

        <Section id="contact" index="15" title="Contact and governing law">
          <p>
            Questions, requests, or concerns about this notice or how Angainor
            handles personal data can be directed to:
          </p>
          <DL
            rows={[
              [
                "Privacy contact",
                <a href={PRIVACY_CONTACT} className="text-white/90 underline underline-offset-4 hover:text-white">
                  privacy@angainor.io
                </a>,
              ],
              [
                "General contact",
                <a href={DEMO_CTA} className="text-white/90 underline underline-offset-4 hover:text-white">
                  founders@angainor.io
                </a>,
              ],
              ["Entity", "Angainor, Inc. — a Delaware corporation."],
              [
                "Governing law",
                "This notice is governed by the laws of the State of Delaware, without regard to conflict-of-laws principles, except to the extent overridden by mandatory local law.",
              ],
              [
                "Jurisdiction",
                "Exclusive jurisdiction and venue lie with the state and federal courts located in New Castle County, Delaware, except where mandatory local law grants data subjects a right to an alternate forum.",
              ],
            ]}
          />
          <p className="text-white/45 text-sm pt-2">
            This notice is provided for informational purposes. It is not
            legal advice. It does not create or modify any contractual rights
            between Angainor and any person or entity. Where a Customer has
            executed a Master Services Agreement and Data Processing Addendum
            with Angainor, those instruments control.
          </p>
        </Section>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/10 py-14">
        <div className="mx-auto max-w-7xl px-6 md:px-10 flex flex-wrap items-center justify-between gap-6">
          <img src="/logo-combomark-white.svg" alt="Angainor" className="h-6" />
          <div className="flex items-center gap-4 text-[11px] tracking-[0.1em] uppercase text-white/45">
            <Link to="/" className="hover:text-white transition-colors">
              Back to home
            </Link>
            <span className="h-3 w-px bg-white/10" />
            <a href={PRIVACY_CONTACT} className="hover:text-white transition-colors">
              Privacy contact
            </a>
            <span className="h-3 w-px bg-white/10" />
            <a href={DEMO_CTA} className="hover:text-white transition-colors">
              Book a demo
            </a>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 md:px-10 mt-8 text-[11px] tracking-[0.1em] uppercase text-white/35">
          © {new Date().getFullYear()} Angainor. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
