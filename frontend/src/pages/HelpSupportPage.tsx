import { useState } from 'react';
import { PageHeader } from '@/components/kadra/PageHeader';
import { SectionCard } from '@/components/kadra/SectionCard';
import {
  ChevronDown, ChevronUp, BookOpen, Shield, Users, Landmark,
  PieChart, ArrowLeftRight, FileText, Mail, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_ROLES } from '@/config/constants';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const adminFaqs: FaqItem[] = [
  {
    category: 'Fund Setup',
    question: 'How do I upload and anchor a Master LPA?',
    answer: 'Navigate to Subscriptions, click "Upload LPA", and select your Master LPA PDF. Angainor will generate a SHA-256 hash and anchor it on-chain with a timestamp and document reference. Subscription records are automatically created for each investor defined in the document.',
  },
  {
    category: 'Fund Setup',
    question: 'How does document provenance work?',
    answer: 'Every uploaded document is hashed using SHA-256. The hash, along with a timestamp and document reference, is anchored on-chain. This creates a tamper-resistant, independently verifiable record. The original document is stored off-chain while the hash serves as cryptographic proof of its contents at a specific point in time.',
  },
  {
    category: 'Settlement',
    question: 'How does the 3-way settlement match work?',
    answer: 'When you upload a wire confirmation, Angainor performs three validation checks: (1) the payment amount matches the subscription commitment, (2) the investor identity on the wire matches the subscription holder, and (3) the payment reference matches the subscription reference. All three must pass before settlement is confirmed. This eliminates the risk of double settlement.',
  },
  {
    category: 'Settlement',
    question: 'What happens after settlement confirmation?',
    answer: 'Once all three validation checks pass, the subscription status flips from Pending to Settled. If this is the first settlement for the fund, the ERC-3643 security token is deployed. Tokens are then minted to the investor\'s verified wallet address matching their ownership percentage.',
  },
  {
    category: 'Transfers',
    question: 'Why was a transfer rejected?',
    answer: 'ERC-3643 transfer restrictions are enforced deterministically on-chain. Both the sender and recipient must have verified identities and active LP eligibility for the fund. If either party fails the identity registry check, the transfer is rejected immediately with no pending state. Check the Investors page to verify both parties\' eligibility status.',
  },
  {
    category: 'Cap Table',
    question: 'How is the cap table calculated?',
    answer: 'The cap table reads directly from the blockchain, showing real-time token balances for each verified wallet. Ownership percentages are calculated as each wallet\'s token balance divided by total supply. No manual spreadsheet reconciliation is needed — the on-chain ledger is the single source of truth.',
  },
  {
    category: 'Distribution',
    question: 'How do waterfall distributions work?',
    answer: 'The waterfall configuration is derived from the governing LPA and defines tiers for capital return, preferred return, and GP promote. When you preview a distribution, Angainor pulls the current ownership ledger, reads capital accounts, and applies waterfall tiers sequentially. The result is a per-LP breakdown showing gross and net amounts for each tier.',
  },
  {
    category: 'Audit',
    question: 'What\'s included in the audit export?',
    answer: 'The audit package includes: CSV cap table with ownership history, PDF hash registry with settlement timeline and transfer log, and on-chain proofs. All are bundled into a single downloadable ZIP file. Each record traces back to its source document hash and timestamp.',
  },
];

const investorFaqs: FaqItem[] = [
  {
    category: 'Getting Started',
    question: 'How do I connect my wallet?',
    answer: 'Go to Profile & Wallets, click "Connect Wallet", and select your wallet provider (MetaMask or Phantom). You\'ll be asked to sign a verification message — this proves wallet ownership without sharing your private key. Once verified, your wallet is linked to your investor profile.',
  },
  {
    category: 'Getting Started',
    question: 'What does fund eligibility mean?',
    answer: 'Fund eligibility is a status set by the fund administrator that authorizes your wallet to hold fund tokens. Having a linked wallet does not automatically grant eligibility — the admin must approve your wallet for each specific fund. This ensures compliance with the fund\'s LP requirements.',
  },
  {
    category: 'Subscriptions',
    question: 'How do I track my subscription status?',
    answer: 'Visit My Subscriptions to see all your subscription records. Each shows the committed amount, allocation percentage, and current status (Pending or Settled). Once the fund administrator confirms your wire payment and it passes the 3-way match, your status will update to Settled.',
  },
  {
    category: 'Ownership',
    question: 'How do I see my ownership position?',
    answer: 'The Cap Table page shows your current token balance and ownership percentage, read directly from the blockchain. This is always accurate and up-to-date — no manual reconciliation needed.',
  },
  {
    category: 'Transfers',
    question: 'Can I transfer my tokens to another investor?',
    answer: 'Transfers are possible between verified LP wallets only. Both you and the recipient must have verified identities and active fund eligibility. The transfer is checked on-chain before execution — if either party doesn\'t meet the requirements, the transfer is rejected immediately.',
  },
  {
    category: 'Distributions',
    question: 'How are distributions calculated?',
    answer: 'Distributions follow the waterfall rules defined in your fund\'s Master LPA. Your share is calculated based on your ownership percentage, applied through the waterfall tiers (preferred return, return of capital, GP promote). View your distribution history on the Distributions page.',
  },
];

const platformLinks = [
  { label: 'Overview', icon: BookOpen, path: '/dashboard', description: 'Fund dashboard and key metrics' },
  { label: 'Investors', icon: Users, path: '/investors', description: 'Manage investor identities and eligibility' },
  { label: 'Settlement', icon: Landmark, path: '/settlement', description: '3-way match wire confirmation' },
  { label: 'Cap Table', icon: PieChart, path: '/cap-table', description: 'Real-time on-chain ownership' },
  { label: 'Transfers', icon: ArrowLeftRight, path: '/transfers', description: 'ERC-3643 compliant transfers' },
  { label: 'Audit & Exports', icon: FileText, path: '/audit', description: 'Export audit packages' },
];

export default function HelpSupportPage() {
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const { user } = useAuth();
  const isAdmin = user?.role && (ADMIN_ROLES as readonly string[]).includes(user.role);
  const faqs = isAdmin ? adminFaqs : investorFaqs;

  // Group FAQs by category
  const categories = [...new Set(faqs.map(f => f.category))];

  const toggleFaq = (question: string) => {
    setOpenFaq(prev => (prev === question ? null : question));
  };

  return (
    <div>
      <PageHeader title="Help & Support" subtitle="Learn how to use Angainor" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FAQ Section - takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Frequently Asked Questions">
            <div className="space-y-6">
              {categories.map(category => (
                <div key={category}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    {category}
                  </h4>
                  <div className="space-y-2">
                    {faqs
                      .filter(f => f.category === category)
                      .map(faq => (
                        <div key={faq.question} className="border border-border rounded-lg">
                          <button
                            onClick={() => toggleFaq(faq.question)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
                          >
                            <span className="text-sm font-medium text-foreground pr-4">{faq.question}</span>
                            {openFaq === faq.question ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                          </button>
                          <div
                            className={cn(
                              'overflow-hidden transition-all duration-200',
                              openFaq === faq.question ? 'max-h-96' : 'max-h-0',
                            )}
                          >
                            <p className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                              {faq.answer}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Support */}
          <SectionCard title="Contact Support">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Email Support</p>
                  <a
                    href="mailto:support@angainor.io"
                    className="text-sm text-primary hover:underline"
                  >
                    support@angainor.io
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Security Issues</p>
                  <a
                    href="mailto:security@angainor.io"
                    className="text-sm text-primary hover:underline"
                  >
                    security@angainor.io
                  </a>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Quick Links - admin only */}
          {isAdmin && (
            <SectionCard title="Platform Guide">
              <div className="space-y-2">
                {platformLinks.map(link => (
                  <a
                    key={link.path}
                    href={link.path}
                    className="flex items-start gap-3 p-2 -mx-2 rounded-md hover:bg-muted transition-colors group"
                  >
                    <link.icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0 group-hover:text-primary transition-colors" />
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {link.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{link.description}</p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </a>
                ))}
              </div>
            </SectionCard>
          )}

          {/* About */}
          <SectionCard title="About Angainor">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Angainor is the programmable infrastructure layer for private real estate funds.
              It replaces manual, siloed back-office workflows with a blockchain-based
              settlement engine, automating administration, eliminating wire fraud, and
              reducing settlement times from weeks to seconds.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Version 1.0.0
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
