import { Link } from "react-router-dom";
import {
  FileText,
  Users,
  Landmark,
  Shield,
  PieChart,
  ArrowRight,
  CheckCircle2,
  Building2,
  Wallet,
  ChevronRight,
} from "lucide-react";

function HeroIllustration() {
  return (
    <svg viewBox="0 0 400 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <rect x="40" y="40" width="320" height="240" rx="16" fill="#f3f4f6" />
      <rect x="60" y="70" width="120" height="80" rx="8" fill="#e0e7ff" />
      <rect x="70" y="110" width="16" height="30" rx="4" fill="#4338ca" />
      <rect x="94" y="95" width="16" height="45" rx="4" fill="#4338ca" opacity="0.7" />
      <rect x="118" y="100" width="16" height="40" rx="4" fill="#4338ca" opacity="0.4" />
      <rect x="142" y="85" width="16" height="55" rx="4" fill="#4338ca" opacity="0.6" />
      <rect x="200" y="70" width="140" height="36" rx="8" fill="#e0e7ff" />
      <rect x="212" y="80" width="60" height="6" rx="3" fill="#4338ca" />
      <rect x="212" y="90" width="40" height="4" rx="2" fill="#4338ca" opacity="0.4" />
      <rect x="200" y="120" width="140" height="36" rx="8" fill="#e0e7ff" />
      <circle cx="220" cy="138" r="10" fill="#4338ca" opacity="0.2" />
      <path d="M216 138l3 3 6-6" stroke="#4338ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="236" y="132" width="80" height="5" rx="2.5" fill="#4338ca" opacity="0.3" />
      <rect x="236" y="141" width="50" height="4" rx="2" fill="#4338ca" opacity="0.15" />
      <rect x="60" y="170" width="280" height="90" rx="8" fill="#e0e7ff" />
      <rect x="80" y="186" width="240" height="6" rx="3" fill="#4338ca" opacity="0.2" />
      <rect x="80" y="200" width="200" height="6" rx="3" fill="#4338ca" opacity="0.15" />
      <rect x="80" y="214" width="160" height="6" rx="3" fill="#4338ca" opacity="0.1" />
      <circle cx="300" cy="210" r="24" fill="#4338ca" opacity="0.15" />
      <path d="M290 210l6 6 14-14" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SecurityIllustration() {
  return (
    <svg viewBox="0 0 360 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
      <circle cx="180" cy="150" r="120" fill="#e0e7ff" opacity="0.4" />
      <circle cx="180" cy="150" r="80" fill="#e0e7ff" opacity="0.6" />
      <path d="M180 80c-30 0-55 10-55 10v70c0 40 55 70 55 70s55-30 55-70v-70s-25-10-55-10z" fill="#4338ca" opacity="0.15" stroke="#4338ca" strokeWidth="2.5" />
      <path d="M165 150l10 10 22-22" stroke="#4338ca" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="60" y="60" width="40" height="28" rx="6" fill="#f3f4f6" stroke="#4338ca" strokeWidth="1.5" opacity="0.6" />
      <rect x="68" y="68" width="24" height="3" rx="1.5" fill="#4338ca" opacity="0.4" />
      <rect x="68" y="75" width="16" height="3" rx="1.5" fill="#4338ca" opacity="0.25" />
      <rect x="260" y="60" width="40" height="28" rx="6" fill="#f3f4f6" stroke="#4338ca" strokeWidth="1.5" opacity="0.6" />
      <rect x="268" y="68" width="24" height="3" rx="1.5" fill="#4338ca" opacity="0.4" />
      <rect x="268" y="75" width="16" height="3" rx="1.5" fill="#4338ca" opacity="0.25" />
      <line x1="100" y1="74" x2="140" y2="120" stroke="#4338ca" strokeWidth="1.5" opacity="0.3" strokeDasharray="4 4" />
      <line x1="260" y1="74" x2="220" y2="120" stroke="#4338ca" strokeWidth="1.5" opacity="0.3" strokeDasharray="4 4" />
      <circle cx="100" cy="240" r="16" fill="#f3f4f6" stroke="#4338ca" strokeWidth="1.5" opacity="0.6" />
      <circle cx="260" cy="240" r="16" fill="#f3f4f6" stroke="#4338ca" strokeWidth="1.5" opacity="0.6" />
      <line x1="110" y1="230" x2="155" y2="195" stroke="#4338ca" strokeWidth="1.5" opacity="0.3" strokeDasharray="4 4" />
      <line x1="250" y1="230" x2="205" y2="195" stroke="#4338ca" strokeWidth="1.5" opacity="0.3" strokeDasharray="4 4" />
    </svg>
  );
}

const problemCards = [
  {
    icon: FileText,
    title: "Siloed Ledgers",
    description: "Multiple parties maintain separate records. Nobody has the full picture.",
  },
  {
    icon: Shield,
    title: "Wire Fraud Risk",
    description: "Every handoff is an attack surface. Most breaches happen during transfers.",
  },
  {
    icon: Landmark,
    title: "Manual Reconciliation",
    description: "Spreadsheet modeling, human errors, weeks of settlement delays.",
  },
];

const steps = [
  {
    number: 1,
    title: "Upload LPA",
    description: "Upload your Master LPA. Angainor hashes and anchors it on-chain.",
  },
  {
    number: 2,
    title: "Settle Capital",
    description: "Upload wire confirmations. 3-way match validates automatically.",
  },
  {
    number: 3,
    title: "Tokenize Ownership",
    description: "ERC-3643 tokens minted to verified LP wallets.",
  },
  {
    number: 4,
    title: "Distribute & Audit",
    description: "Waterfall distributions. Audit packages generated instantly.",
  },
];

const features = [
  {
    icon: FileText,
    title: "Document Provenance",
    description: "SHA-256 hashing with on-chain anchoring. Every document traced to its source.",
  },
  {
    icon: Users,
    title: "Identity Permissioning",
    description: "Wallet-based investor registry. Real-world identities mapped to on-chain addresses.",
  },
  {
    icon: Landmark,
    title: "Automated Settlement",
    description: "3-way wire match eliminates manual verification. No double settlement possible.",
  },
  {
    icon: Shield,
    title: "On-Chain Compliance",
    description: "ERC-3643 transfer restrictions enforced deterministically. Rules before violations.",
  },
  {
    icon: PieChart,
    title: "Real-Time Cap Table",
    description: "Always correct. Reads directly from blockchain. No spreadsheet reconciliation.",
  },
  {
    icon: Shield,
    title: "Audit-Ready Exports",
    description: "CSV, PDF, and on-chain proofs bundled in one downloadable package.",
  },
];

const whyKadraPoints = [
  {
    title: "Verifiable over trusted",
    description: "Cryptographic proofs replace promises. Every action produces an on-chain reference.",
  },
  {
    title: "Deterministic enforcement",
    description: "Rules enforced before violations happen, not after.",
  },
  {
    title: "Tamper-resistant records",
    description: "Immutable, time-stamped, independently verifiable by any party.",
  },
  {
    title: "Reduced attack surface",
    description: "Fewer handoff points means fewer breach vectors.",
  },
  {
    title: "Seconds, not weeks",
    description: "Settlement in seconds instead of weeks of manual processing.",
  },
];

export default function LandingPage() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="scroll-smooth min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-sm bg-white/90 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-primary rounded-lg h-8 w-8 flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-gray-900 font-bold text-lg">Angainor</span>
            </div>
            <Link
              to="/login"
              className="bg-primary text-white rounded-lg px-5 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
                Fund Infrastructure, Simplified.
              </h1>
              <p className="text-lg text-gray-600 mt-6 max-w-lg">
                Angainor replaces manual, siloed back-office workflows with blockchain-verified
                settlement. One system of record. Zero reconciliation.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  to="/login"
                  className="bg-primary text-white rounded-lg px-8 py-3 font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-2"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => scrollToSection("features")}
                  className="text-gray-600 rounded-lg px-6 py-3 font-semibold hover:text-gray-900 transition-colors inline-flex items-center gap-2"
                >
                  Learn More
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="hidden lg:block">
              <HeroIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section id="problem" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-gray-900">The Old Way Is Broken</h2>
            <p className="mt-4 text-lg text-gray-600">
              Private fund administration relies on fragmented systems that create risk at every
              step.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {problemCards.map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-xl p-8 border border-gray-100"
              >
                <div className="bg-primary/10 rounded-full h-12 w-12 flex items-center justify-center mb-5">
                  <card.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-gray-900">How Angainor Works</h2>
            <p className="mt-4 text-lg text-gray-600">
              Four steps from document upload to audit-ready fund administration.
            </p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
            <div className="grid md:grid-cols-4 gap-8">
              {steps.map((step) => (
                <div key={step.number} className="text-center relative z-10">
                  <div className="flex justify-center mb-4">
                    <div className="bg-primary text-white h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm bg-white ring-4 ring-white">
                      <span className="bg-primary h-10 w-10 rounded-full flex items-center justify-center">
                        {step.number}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white">
                    <h3 className="text-gray-900 font-semibold mb-2">{step.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-gray-900">
              Built for Institutional Fund Administration
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Every feature designed for compliance, auditability, and operational efficiency.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl p-6 border border-gray-100"
              >
                <div className="bg-primary/10 text-primary rounded-lg p-2 inline-flex mb-4">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-gray-900 font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Angainor */}
      <section id="why-angainor" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="hidden lg:block">
              <SecurityIllustration />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">Why Angainor</h2>
              <div className="space-y-6">
                {whyKadraPoints.map((point) => (
                  <div key={point.title} className="flex gap-4">
                    <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-gray-900 font-semibold">{point.title}</h3>
                      <p className="text-gray-600 text-sm mt-1">{point.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Investors / For Fund Managers */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Built for Both Sides</h2>
            <p className="mt-4 text-lg text-gray-600">
              Purpose-built tools for fund managers and their investors.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Fund Managers */}
            <div className="bg-white rounded-xl p-8 border border-gray-100">
              <div className="bg-primary/10 rounded-full h-12 w-12 flex items-center justify-center mb-5">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">For Fund Managers</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                One platform to administer your fund. Upload documents, settle capital, manage
                compliance, and generate audit packages — all from a single dashboard.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  Automated 3-way wire match settlement
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  Real-time cap table with blockchain source of truth
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  One-click audit package export
                </li>
              </ul>
            </div>
            {/* Investors */}
            <div className="bg-white rounded-xl p-8 border border-gray-100">
              <div className="bg-primary/10 rounded-full h-12 w-12 flex items-center justify-center mb-5">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">For Investors</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                Full visibility into your investment. Track subscriptions, view real-time ownership,
                connect your wallet, and access distribution history — all self-service.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  Self-service wallet connection and identity verification
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  Real-time portfolio and ownership tracking
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  Complete distribution and transfer history
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to modernize your fund infrastructure?
          </h2>
          <p className="mt-4 text-lg text-white/80 max-w-xl mx-auto">
            Join the next generation of fund administrators using blockchain-verified settlement
            and compliance.
          </p>
          <Link
            to="/login"
            className="mt-10 inline-block bg-white text-primary rounded-lg px-8 py-3 font-semibold hover:bg-gray-50 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-primary rounded-lg h-7 w-7 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">A</span>
                </div>
                <span className="text-white font-bold">Angainor</span>
              </div>
              <p className="text-sm leading-relaxed mb-6">
                Programmable infrastructure for private funds.
              </p>
              <div className="flex gap-4">
                {/* Twitter/X */}
                <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                {/* LinkedIn */}
                <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
                {/* GitHub */}
                <a href="#" className="text-gray-500 hover:text-gray-300 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                </a>
              </div>
            </div>
            {/* Product */}
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Product</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a
                    href="#features"
                    className="hover:text-gray-300 transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#how-it-works"
                    className="hover:text-gray-300 transition-colors"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-gray-300 transition-colors"
                  >
                    For Investors
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-gray-300 transition-colors"
                  >
                    For Fund Managers
                  </a>
                </li>
              </ul>
            </div>
            {/* Company */}
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Company</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="#" className="hover:text-gray-300 transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-gray-300 transition-colors">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-gray-300 transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-gray-300 transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm text-gray-500">
            &copy; 2024 Angainor. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
