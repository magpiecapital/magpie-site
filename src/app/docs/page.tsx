import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Documentation | Magpie",
  description:
    "Technical documentation for the Magpie lending protocol. Architecture, security model, loan lifecycle, and credit system.",
};

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "loan-lifecycle", label: "Loan Lifecycle" },
  { id: "pricing-oracles", label: "Pricing & Oracles" },
  { id: "fee-structure", label: "Fee Structure" },
  { id: "credit-system", label: "Credit System" },
  { id: "security-model", label: "Security Model" },
  { id: "wallet-model", label: "Wallet Model" },
  { id: "supported-tokens", label: "Supported Tokens" },
  { id: "api-integration", label: "API & Integration" },
];

const CREDIT_TIERS = [
  {
    name: "Bronze",
    range: "300 - 499",
    color: "var(--ink-soft)",
    benefits: ["Standard rates", "Standard terms", "Community support"],
  },
  {
    name: "Silver",
    range: "500 - 649",
    color: "var(--ink-faint)",
    benefits: ["+2% LTV bonus", "Priority support", "Early notifications"],
  },
  {
    name: "Gold",
    range: "650 - 749",
    color: "var(--accent)",
    benefits: ["+5% LTV bonus", "Reduced fees (1.25%)", "Extended terms available"],
  },
  {
    name: "Platinum",
    range: "750 - 850",
    color: "var(--accent-deep)",
    benefits: ["+8% LTV bonus", "Lowest fees (1.0–2.5%)", "Custom terms & early access"],
  },
];

const CREDIT_FACTORS = [
  { factor: "Repayment history", weight: "40%", desc: "On-time full repayments vs late or liquidated" },
  { factor: "Loan volume", weight: "20%", desc: "Total SOL borrowed across all loans" },
  { factor: "Account age", weight: "15%", desc: "Time since first loan originated" },
  { factor: "Collateral diversity", weight: "15%", desc: "Number of unique token mints pledged" },
  { factor: "Liquidation history", weight: "10%", desc: "Inverse of liquidation frequency" },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Mobile section tabs */}
      <div className="sticky top-[65px] z-40 overflow-x-auto border-b border-[var(--hairline)] bg-[var(--bg)]/90 backdrop-blur-md lg:hidden">
        <div className="flex gap-1 px-4 py-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl gap-0 px-6">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-[85px] py-10 pr-8">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
              On this page
            </div>
            <div className="mt-4 flex flex-col gap-0.5">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--ink-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                >
                  {s.label}
                </a>
              ))}
            </div>
            <div className="mt-8 border-t border-[var(--hairline)] pt-6">
              <a
                href={TELEGRAM_URL}
                className="text-[13px] font-semibold text-[var(--accent-deep)] transition hover:text-[var(--accent)]"
              >
                Launch bot →
              </a>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 py-10 lg:border-l lg:border-[var(--hairline)] lg:pl-12">
          {/* Page header */}
          <div className="mb-16">
            <div className="chip mb-4">Technical documentation</div>
            <h1 className="font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">
              Magpie Protocol
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
              Everything you need to understand how Magpie works under the hood &mdash; from
              on-chain architecture to the credit system.
            </p>
          </div>

          {/* ─── Overview ─── */}
          <Section id="overview" title="Overview" chip="Introduction">
            <P>
              Magpie is a memecoin-collateralized lending protocol on Solana, delivered
              entirely through a Telegram bot. Users pledge memecoin holdings as collateral
              and receive SOL loans in seconds &mdash; no browser extensions, no seed phrases,
              no new apps to install.
            </P>
            <Callout>
              <strong>The thesis:</strong> Memecoins represent billions in dormant capital.
              Holders refuse to sell but can&apos;t use that value. Magpie unlocks it as
              liquidity without forcing a sale.
            </Callout>
            <P>
              The protocol is designed around three principles: speed (loans fund in under
              10 seconds), simplicity (tiered fees, three loan tiers, no hidden mechanics), and
              safety (non-custodial, loan-scoped collateral, on-chain liquidation).
            </P>
          </Section>

          {/* ─── Architecture ─── */}
          <Section id="architecture" title="Architecture" chip="On-chain">
            <P>
              Magpie&apos;s core lending logic lives in an Anchor program deployed on Solana
              mainnet. The program is the single source of truth for loan state, collateral
              custody, and liquidation execution.
            </P>

            <H3>Program Derived Addresses</H3>
            <P>
              Each loan creates a unique PDA (Program Derived Address) seeded by the borrower&apos;s
              public key and a loan nonce. The PDA holds all loan state on-chain:
            </P>
            <CodeBlock>{`// Loan PDA fields
{
  borrower:          Pubkey,
  collateral_mint:   Pubkey,
  collateral_amount: u64,
  borrowed_sol:      u64,
  due_date:          i64,
  ltv_tier:          u8,       // 0=Express, 1=Quick, 2=Standard
  health_ratio:      f64,
  status:            LoanStatus,  // Active | Repaid | Liquidated
}`}</CodeBlock>

            <H3>Collateral custody</H3>
            <P>
              Collateral is held in loan-scoped token accounts owned by the program PDA &mdash;
              not the user&apos;s wallet. This means only the pledged collateral is ever at
              risk. The user&apos;s other holdings are untouchable by the protocol.
            </P>

            <H3>Liquidation</H3>
            <P>
              Liquidation is deterministic and on-chain. When a loan&apos;s health ratio drops
              below the 1.1x threshold, anyone can call the liquidation instruction. There is
              no admin override, no manual intervention &mdash; the logic is enforced by the
              program.
            </P>
          </Section>

          {/* ─── Loan Lifecycle ─── */}
          <Section id="loan-lifecycle" title="Loan Lifecycle" chip="Flow">
            <P>
              A typical loan moves through the following stages, all orchestrated from a
              Telegram chat.
            </P>

            <StepList
              steps={[
                {
                  n: "1",
                  title: "Wallet creation",
                  body: "User opens the bot and sends /start. A fresh Solana keypair is generated, encrypted with AES-256-GCM, and stored. The wallet is non-custodial and exportable at any time via /export.",
                },
                {
                  n: "2",
                  title: "Collateral deposit",
                  body: "User receives a unique deposit address scoped to the loan. They send memecoin collateral to this address. A deposit watcher monitors the chain and confirms receipt within 8-12 seconds.",
                },
                {
                  n: "3",
                  title: "Tier selection & quote",
                  body: "User selects a tier: Express (30% LTV, 2 days), Quick (25% LTV, 3 days), or Standard (20% LTV, 7 days). Oracle pricing via Jupiter API values the collateral in SOL and generates a quote.",
                },
                {
                  n: "4",
                  title: "SOL disbursement",
                  body: "SOL is sent to the user's wallet minus the origination fee (3% Express, 2% Quick, 1.5% Standard). The loan PDA is created on-chain with all parameters locked in.",
                },
                {
                  n: "5",
                  title: "Active management",
                  body: "While the loan is active, the user can: top-up collateral to improve health, partial-repay to reduce principal, extend the term (fee matches loan tier), or repay in full to reclaim collateral.",
                },
                {
                  n: "6",
                  title: "Health monitoring",
                  body: "The system continuously monitors collateral value. Alerts fire at 90% health and 24 hours before the due date. Users receive Telegram messages with current health ratio and suggested actions.",
                },
                {
                  n: "7",
                  title: "Resolution",
                  body: "The loan ends one of two ways: the user repays (collateral returned) or health drops below 1.1x and on-chain liquidation executes automatically.",
                },
              ]}
            />
          </Section>

          {/* ─── Pricing & Oracles ─── */}
          <Section id="pricing-oracles" title="Pricing & Oracles" chip="Data">
            <P>
              Accurate, manipulation-resistant pricing is critical for a lending protocol.
              Magpie uses aggregated DEX liquidity via Jupiter&apos;s Price API v2 as the
              primary oracle.
            </P>

            <Table
              headers={["Source", "Purpose", "Update frequency"]}
              rows={[
                ["Jupiter Price API v2", "Loan quotes, health monitoring, liquidation triggers", "Real-time per request"],
                ["DexScreener API", "Market data display (market cap, volume, 24h change)", "~15s polling"],
              ]}
            />

            <H3>Why Jupiter?</H3>
            <P>
              Jupiter aggregates liquidity across all major Solana DEXes (Raydium, Orca,
              Meteora, etc.). This makes price manipulation economically infeasible &mdash;
              an attacker would need to move prices across multiple venues simultaneously.
            </P>

            <H3>Price usage</H3>
            <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-[var(--ink-soft)]">
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span><strong className="text-[var(--ink)]">Loan origination:</strong> collateral valued in SOL to determine payout</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span><strong className="text-[var(--ink)]">Health monitoring:</strong> continuous repricing to detect undercollateralization</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span><strong className="text-[var(--ink)]">Liquidation triggers:</strong> when health ratio breaches 1.1x threshold</span>
              </li>
            </ul>
          </Section>

          {/* ─── Fee Structure ─── */}
          <Section id="fee-structure" title="Fee Structure" chip="Economics">
            <P>
              Magpie uses a simple, transparent fee model. No dynamic APR, no variable
              haircuts, no hidden charges.
            </P>

            <Table
              headers={["Action", "Fee", "Notes"]}
              rows={[
                ["Loan origination", "1.5–3% (tier-dependent)", "Express 3%, Quick 2%, Standard 1.5%"],
                ["Loan extension", "Matches loan tier fee", "Per extension, resets the due date"],
                ["Partial repay", "None", "Reduces principal proportionally"],
                ["Full repay", "None", "Collateral returned in full"],
                ["Top-up collateral", "None", "Improves health ratio"],
                ["Liquidation", "None to user", "Collateral seized, loan closed"],
              ]}
            />

            <Callout>
              <strong>Example:</strong> A 30% LTV loan on $1,000 of collateral disburses $300
              in SOL. At Standard tier (1.5%), the fee is $4.50, so the user receives $295.50 in SOL.
              At Express tier (3%), the fee would be $9.00, netting $291.00. Extending once costs the same tier fee.
            </Callout>
          </Section>

          {/* ─── Credit System ─── */}
          <Section id="credit-system" title="Credit System" chip="New">
            <P>
              The Magpie Credit Score is an on-platform reputation system that rewards
              consistent borrowing behavior with better terms. Scores range from 300 to 850
              and update after every loan event (repayment, extension, liquidation).
            </P>

            <H3>Scoring factors</H3>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--hairline)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--hairline)] bg-[var(--surface)]">
                    <th className="px-5 py-3 font-semibold text-[var(--ink)]">Factor</th>
                    <th className="px-5 py-3 font-semibold text-[var(--ink)]">Weight</th>
                    <th className="px-5 py-3 font-semibold text-[var(--ink)]">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {CREDIT_FACTORS.map((f, i) => (
                    <tr
                      key={f.factor}
                      className={i < CREDIT_FACTORS.length - 1 ? "border-b border-[var(--hairline)]" : ""}
                    >
                      <td className="px-5 py-3 font-medium text-[var(--ink)]">{f.factor}</td>
                      <td className="px-5 py-3 font-mono text-[var(--accent-deep)]">{f.weight}</td>
                      <td className="px-5 py-3 text-[var(--ink-soft)]">{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <H3>Credit tiers</H3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CREDIT_TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 transition hover:border-[var(--hairline-strong)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold tracking-tight">{tier.name}</div>
                    <div
                      className="rounded-full px-2.5 py-1 text-xs font-bold tabular"
                      style={{
                        background: `color-mix(in srgb, ${tier.color} 15%, transparent)`,
                        color: tier.color,
                      }}
                    >
                      {tier.range}
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {tier.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-[var(--ink-soft)]">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <Callout>
              All new users start at 500 (Silver). A single on-time repayment can move the
              score up by 15-25 points. A liquidation can drop it by 50-80 points.
            </Callout>
          </Section>

          {/* ─── Security Model ─── */}
          <Section id="security-model" title="Security Model" chip="Security">
            <P>
              Security is a core design constraint, not a feature bolted on after the fact.
              Every layer of the stack is built to minimize trust assumptions.
            </P>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Non-custodial wallets",
                  body: "Users can export their private keys anytime via /export. Magpie never controls assets outside of pledged collateral.",
                },
                {
                  title: "Loan-scoped addresses",
                  body: "Only the specific collateral pledged to a loan is at risk. The user's wallet contents are never accessible to the protocol.",
                },
                {
                  title: "AES-256-GCM encryption",
                  body: "Private keys are encrypted at rest using AES-256-GCM before storage. Keys are never stored in plaintext.",
                },
                {
                  title: "On-chain liquidation",
                  body: "Liquidation is deterministic, auditable, and has no admin override. The program logic is the final authority.",
                },
                {
                  title: "Open source",
                  body: "Both the site and bot code are publicly available on GitHub. Anyone can audit the protocol logic.",
                },
                {
                  title: "Rate limiting & input sanitization",
                  body: "All API endpoints are rate-limited. All user-facing inputs are sanitized to prevent injection attacks.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5"
                >
                  <div className="text-sm font-semibold tracking-tight text-[var(--ink)]">
                    {item.title}
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                    {item.body}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ─── Wallet Model ─── */}
          <Section id="wallet-model" title="Wallet Model" chip="Infrastructure">
            <P>
              Magpie generates and manages Solana keypairs for users who interact through
              Telegram. The model prioritizes portability and user sovereignty.
            </P>

            <H3>Key lifecycle</H3>
            <CodeBlock>{`/start  → Fresh Ed25519 keypair generated
        → Private key encrypted with AES-256-GCM
        → Encrypted blob stored in database
        → Public key returned to user as deposit address

/export → Private key decrypted in memory
        → Sent to user via Telegram (ephemeral message)
        → Auto-deleted after 60 seconds
        → User can import into Phantom, Solflare, etc.`}</CodeBlock>

            <H3>Deposit addresses</H3>
            <P>
              Each loan gets its own deposit address. This is a program-derived token account
              scoped to the loan PDA. Collateral sent to one loan&apos;s address cannot be
              accessed by another loan or by Magpie directly.
            </P>

            <Callout>
              <strong>Non-custodial guarantee:</strong> At no point does Magpie have
              unilateral access to user funds outside of explicitly pledged collateral held
              in loan-scoped PDAs.
            </Callout>
          </Section>

          {/* ─── Supported Tokens ─── */}
          <Section id="supported-tokens" title="Supported Tokens" chip="Collateral">
            <P>
              Magpie currently supports <strong>64+ Solana memecoins</strong> as loan
              collateral. Tokens are approved based on DEX liquidity depth, trading volume,
              and price stability requirements.
            </P>

            <H3>Approval criteria</H3>
            <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-[var(--ink-soft)]">
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span>Sufficient DEX liquidity across at least two venues</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span>Consistent 24h trading volume above minimum threshold</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span>Price available via Jupiter Price API v2</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span>No evidence of rug-pull risk or contract vulnerabilities</span>
              </li>
            </ul>

            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold text-[var(--ink)]">Browse all supported tokens</div>
                <div className="mt-1 text-sm text-[var(--ink-soft)]">
                  Live prices, market caps, 24h performance, and token request form.
                </div>
              </div>
              <Link
                href="/tokens"
                className="btn-ghost shrink-0 text-sm"
              >
                View tokens →
              </Link>
            </div>
          </Section>

          {/* ─── API & Integration ─── */}
          <Section id="api-integration" title="API & Integration" chip="Technical">
            <P>
              Magpie integrates several external services and frameworks to deliver
              the lending experience.
            </P>

            <Table
              headers={["Layer", "Technology", "Purpose"]}
              rows={[
                ["User interface", "Telegram Bot API", "Chat-based loan management, notifications, wallet export"],
                ["On-chain program", "Anchor (Rust)", "Loan PDA creation, collateral custody, liquidation logic"],
                ["Blockchain client", "Solana Web3.js", "Transaction construction, signing, submission, and confirmation"],
                ["Pricing oracle", "Jupiter API v2", "Real-time aggregated token pricing across all Solana DEXes"],
                ["Market data", "DexScreener API", "Market cap, volume, 24h change for display purposes"],
                ["Frontend", "Next.js + React", "Marketing site, calculator, token browser, dashboard"],
              ]}
            />

            <H3>Transaction flow</H3>
            <CodeBlock>{`User (Telegram)
  │
  ├─ /borrow → Bot validates input
  │              → Jupiter API: fetch price
  │              → Anchor: create loan PDA + transfer collateral
  │              → Solana Web3.js: disburse SOL
  │              → Telegram: send confirmation
  │
  ├─ /repay  → Anchor: close loan PDA + return collateral
  │              → Telegram: send receipt
  │
  └─ Health monitor (background)
       → Jupiter API: reprice collateral
       → If health < 1.1x → Anchor: liquidate
       → Telegram: alert user`}</CodeBlock>
          </Section>

          {/* Bottom spacer */}
          <div className="mt-20 border-t border-[var(--hairline)] pt-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[var(--ink-soft)]">
                Questions? Reach out on{" "}
                <a
                  href={TELEGRAM_URL}
                  className="font-semibold text-[var(--accent-deep)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
                >
                  Telegram
                </a>
                .
              </div>
              <Link href="/" className="text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)]">
                ← Back to home
              </Link>
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}

/* ───────────── Reusable doc components ───────────── */

function Section({
  id,
  title,
  chip,
  children,
}: {
  id: string;
  title: string;
  chip: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-20 scroll-mt-28">
      <div className="chip mb-4">{chip}</div>
      <h2 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-8 mb-3 text-lg font-semibold tracking-tight text-[var(--ink)]">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-soft)]">
      {children}
    </p>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-dim)] px-6 py-5 text-[15px] leading-relaxed text-[var(--ink-soft)]">
      {children}
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5 font-mono text-[13px] leading-relaxed text-[var(--ink)]">
      <code>{children}</code>
    </pre>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--hairline)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--hairline)] bg-[var(--surface)]">
            {headers.map((h) => (
              <th key={h} className="px-5 py-3 font-semibold text-[var(--ink)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={i < rows.length - 1 ? "border-b border-[var(--hairline)]" : ""}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-5 py-3 ${j === 0 ? "font-medium text-[var(--ink)]" : "text-[var(--ink-soft)]"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepList({ steps }: { steps: { n: string; title: string; body: string }[] }) {
  return (
    <div className="mt-6 space-y-4">
      {steps.map((s) => (
        <div
          key={s.n}
          className="flex gap-5 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] font-mono text-xs font-semibold text-[var(--ink-soft)]">
            {s.n}
          </div>
          <div>
            <div className="font-semibold tracking-tight text-[var(--ink)]">{s.title}</div>
            <div className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">
              {s.body}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

