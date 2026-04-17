import type { Metadata } from "next";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Whitepaper | Magpie",
  description:
    "Magpie Protocol Litepaper — Memecoin-collateralized lending on Solana via Telegram.",
};

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

const TOC = [
  { id: "abstract", n: "1", label: "Abstract" },
  { id: "problem", n: "2", label: "Problem Statement" },
  { id: "solution", n: "3", label: "Solution Overview" },
  { id: "architecture", n: "4", label: "Protocol Architecture" },
  { id: "mechanics", n: "5", label: "Loan Mechanics" },
  { id: "pricing", n: "6", label: "Pricing & Risk Management" },
  { id: "credit", n: "7", label: "Credit System" },
  { id: "points", n: "8", label: "Points & Incentives" },
  { id: "security", n: "9", label: "Security Model" },
  { id: "tokenomics", n: "10", label: "Tokenomics (Future)" },
  { id: "roadmap", n: "11", label: "Roadmap" },
  { id: "conclusion", n: "12", label: "Conclusion" },
];

const CREDIT_FACTORS = [
  { factor: "Repayment history", weight: "40%", desc: "On-time full repayments vs late or liquidated" },
  { factor: "Loan volume", weight: "20%", desc: "Total SOL borrowed across all loans" },
  { factor: "Account age", weight: "15%", desc: "Time since first loan originated" },
  { factor: "Collateral diversity", weight: "15%", desc: "Number of unique token mints pledged" },
  { factor: "Liquidation history", weight: "10%", desc: "Inverse of liquidation frequency" },
];

const CREDIT_TIERS = [
  { name: "Bronze", range: "300 - 499", color: "var(--ink-soft)", benefits: "Standard rates, standard terms" },
  { name: "Silver", range: "500 - 649", color: "var(--ink-faint)", benefits: "+2% LTV bonus, priority support" },
  { name: "Gold", range: "650 - 749", color: "var(--accent)", benefits: "+5% LTV bonus, reduced fees (1.25%)" },
  { name: "Platinum", range: "750 - 850", color: "var(--accent-deep)", benefits: "+8% LTV bonus, 1% fee, custom terms" },
];

const ROADMAP = [
  { q: "Q1 2026", status: "done", items: "Protocol launch, 64 token support, Telegram bot live" },
  { q: "Q2 2026", status: "done", items: "Credit system, points, public API, open source" },
  { q: "Q3 2026", status: "upcoming", items: "Multi-chain expansion, governance token, mobile app" },
  { q: "Q4 2026", status: "upcoming", items: "Institutional pools, DAO governance, cross-chain lending" },
];

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Wordmark size={28} />
          </Link>
          <nav className="flex items-center gap-8">
            <Link href="/docs" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Docs
            </Link>
            <Link href="/security" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Security
            </Link>
            <Link href="/about" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              About
            </Link>
            <Link href="/tokens" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Tokens
            </Link>
            <a href={TELEGRAM_URL} className="btn-accent text-sm">Launch</a>
          </nav>
        </div>
      </header>

      {/* Mobile TOC */}
      <div className="sticky top-[65px] z-40 overflow-x-auto border-b border-[var(--hairline)] bg-[var(--bg)]/90 backdrop-blur-md lg:hidden">
        <div className="flex gap-1 px-4 py-2">
          {TOC.map((s) => (
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
              Table of contents
            </div>
            <div className="mt-4 flex flex-col gap-0.5">
              {TOC.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-baseline gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--ink-soft)] transition hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                >
                  <span className="font-mono text-[11px] text-[var(--ink-faint)]">{s.n}.</span>
                  {s.label}
                </a>
              ))}
            </div>
            <div className="mt-8 border-t border-[var(--hairline)] pt-6">
              <a
                href="#"
                className="flex items-center gap-2 text-[13px] font-semibold text-[var(--accent-deep)] transition hover:text-[var(--accent)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download PDF
              </a>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 py-10 lg:border-l lg:border-[var(--hairline)] lg:pl-12">

          {/* ─── Title ─── */}
          <div className="mb-20">
            <div className="chip mb-4">Litepaper v1.0</div>
            <div className="flex items-center gap-4 mb-4">
              <Mark size={48} />
            </div>
            <h1 className="font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl lg:text-6xl">
              Magpie Protocol
            </h1>
            <p className="mt-3 text-lg text-[var(--ink-soft)]">
              Litepaper v1.0 &mdash; April 2026
            </p>
            <p className="mt-2 max-w-xl text-xl font-medium tracking-tight text-[var(--accent-deep)]">
              Memecoin-Collateralized Lending on Solana
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#" className="btn-ghost text-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download PDF
              </a>
              <Link href="/docs" className="btn-ghost text-sm">
                Technical Docs &rarr;
              </Link>
            </div>
          </div>

          {/* ─── 1. Abstract ─── */}
          <Reveal>
            <Section id="abstract" n="1" title="Abstract">
              <P>
                Magpie is a non-custodial lending protocol built on Solana that enables holders of
                memecoin assets to borrow SOL against their holdings without selling. The protocol
                operates entirely through a Telegram bot interface, removing the complexity of
                traditional DeFi dApps. Magpie introduces the first on-chain credit scoring system
                for memecoin lending, allowing borrowers to build reputation and unlock progressively
                better terms. With 64+ supported collateral tokens, sub-10-second funding, and
                deterministic on-chain liquidation, Magpie bridges the gap between memecoin culture
                and DeFi utility.
              </P>
            </Section>
          </Reveal>

          {/* ─── 2. Problem Statement ─── */}
          <Reveal>
            <Section id="problem" n="2" title="Problem Statement">
              <P>
                Memecoins represent over <Strong>$50B in market capitalization</Strong> on Solana
                alone. Holders are emotionally and financially invested &mdash; selling is often
                psychologically impossible. Yet the existing DeFi ecosystem offers them almost nothing.
              </P>
              <BulletList items={[
                "Traditional DeFi lending protocols (Aave, Solend, Kamino) ignore memecoins entirely due to volatility risk",
                "Result: billions in dormant capital with no liquidity solution",
                "Current options for holders: sell (realize loss), margin trade (complex), or do nothing (miss opportunities)",
                "Most DeFi requires browser wallets, seed phrases, and complex multi-step UIs",
                "Memecoin communities live on Telegram — not in browser dApps",
              ]} />
              <Callout>
                The core problem is clear: the largest and most active community in crypto has
                billions in assets and zero access to lending infrastructure built for them.
              </Callout>
            </Section>
          </Reveal>

          {/* ─── 3. Solution Overview ─── */}
          <Reveal>
            <Section id="solution" n="3" title="Solution Overview">
              <P>
                Magpie is a Telegram-native lending protocol on Solana purpose-built for memecoin
                holders. The protocol accepts 64+ memecoin tokens as collateral and delivers SOL
                loans in under 10 seconds.
              </P>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { label: "Three risk tiers", detail: "Express (30% LTV, 2d), Quick (25% LTV, 3d), Standard (20% LTV, 7d)" },
                  { label: "Flat 1.5% origination fee", detail: "No hidden rates, no dynamic APR, no variable haircuts" },
                  { label: "Non-custodial wallet model", detail: "Exportable keys — import into Phantom, Solflare, any Solana wallet" },
                  { label: "On-chain program (Anchor)", detail: "Deterministic loan execution, collateral custody, and liquidation" },
                  { label: "Credit system", detail: "Build reputation across loans, unlock better LTV and reduced fees" },
                  { label: "Points system", detail: "Earn points through engagement, early repayment, and diversity" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5"
                  >
                    <div className="text-sm font-semibold tracking-tight text-[var(--ink)]">
                      {item.label}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                      {item.detail}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </Reveal>

          {/* ─── 4. Protocol Architecture ─── */}
          <Reveal>
            <Section id="architecture" n="4" title="Protocol Architecture">
              <P>
                Magpie&apos;s technical stack spans on-chain and off-chain layers, connected through
                a Telegram bot interface that abstracts all blockchain complexity from the end user.
              </P>

              <H3>Technical stack</H3>
              <Table
                headers={["Layer", "Technology", "Purpose"]}
                rows={[
                  ["On-chain program", "Anchor (Rust)", "Loan PDA creation, collateral custody, liquidation logic"],
                  ["State management", "Program Derived Addresses", "Loan-scoped state and collateral vaults"],
                  ["User interface", "grammY (Telegram)", "Chat-based loan management, notifications, wallet export"],
                  ["Off-chain indexing", "PostgreSQL", "User data, loan history, credit scores, points"],
                  ["Pricing oracle", "Jupiter Price API v2", "Real-time aggregated token pricing across all Solana DEXes"],
                  ["Market data", "DexScreener API", "Market cap, volume, 24h change for display"],
                  ["Key encryption", "AES-256-GCM", "Wallet private key encryption at rest"],
                  ["Background jobs", "Node.js watchers", "Deposit detection, health monitoring, loan expiry"],
                ]}
              />

              <H3>Architecture diagram</H3>
              <CodeBlock>{`User <-> Telegram <-> Magpie Bot <-> Solana Program
                            |               |
                        PostgreSQL    Token Vaults (PDAs)
                            |
                       Jupiter Oracle`}</CodeBlock>

              <H3>Data flow</H3>
              <P>
                All user interactions originate from Telegram. The bot validates input, queries
                pricing oracles, constructs and submits Solana transactions, then returns
                confirmations to the user &mdash; all within a single chat interface. Off-chain
                state (credit scores, points, user preferences) is indexed in PostgreSQL,
                while all financial state (loan terms, collateral custody) lives on-chain in PDAs.
              </P>
            </Section>
          </Reveal>

          {/* ─── 5. Loan Mechanics ─── */}
          <Reveal>
            <Section id="mechanics" n="5" title="Loan Mechanics">
              <P>
                A Magpie loan moves through a deterministic lifecycle, from wallet creation
                to resolution. Every step is orchestrated from a Telegram chat.
              </P>

              <H3>Lifecycle</H3>
              <StepList steps={[
                { n: "1", title: "Wallet creation", body: "User opens the bot and sends /start. A fresh Ed25519 keypair is generated, encrypted with AES-256-GCM, and stored. The wallet is non-custodial and exportable at any time." },
                { n: "2", title: "Collateral deposit", body: "User receives a unique deposit address scoped to the loan. Memecoin collateral is sent to this address. A background watcher confirms receipt on-chain within 8-12 seconds." },
                { n: "3", title: "Price oracle & LTV calculation", body: "Jupiter Price API v2 values the collateral in SOL. The user selects a tier (Express, Quick, or Standard), and the protocol calculates the maximum loan amount." },
                { n: "4", title: "SOL disbursement", body: "SOL is sent to the user's wallet minus the 1.5% origination fee. The loan PDA is created on-chain with all parameters immutably recorded." },
                { n: "5", title: "Active management", body: "While active, the user can: top-up collateral, partial-repay to reduce principal, extend the term (1.5% fee), or repay in full to reclaim collateral." },
                { n: "6", title: "Health monitoring", body: "Continuous repricing of collateral. Alerts fire at 90% health and 24 hours before the due date. Users receive Telegram messages with current health ratio." },
                { n: "7", title: "Resolution", body: "The loan ends one of two ways: the user repays in full (collateral returned) or health drops below 1.1x and on-chain liquidation executes automatically." },
              ]} />

              <H3>Core formulas</H3>
              <CodeBlock>{`Loan Amount   = Collateral Value (SOL) x LTV%
Fee           = Loan Amount x 1.5%
Net Payout    = Loan Amount - Fee
Health Ratio  = Collateral Value / Loan Amount

Liquidation triggers when Health < 1.1`}</CodeBlock>

              <H3>Tier comparison</H3>
              <Table
                headers={["Tier", "LTV", "Term", "Use case"]}
                rows={[
                  ["Express", "30%", "2 days", "Maximum liquidity, short-term needs"],
                  ["Quick", "25%", "3 days", "Balanced risk/reward"],
                  ["Standard", "20%", "7 days", "Conservative, extended timeline"],
                ]}
              />
            </Section>
          </Reveal>

          {/* ─── 6. Pricing & Risk Management ─── */}
          <Reveal>
            <Section id="pricing" n="6" title="Pricing & Risk Management">
              <P>
                Accurate, manipulation-resistant pricing is critical for any lending protocol.
                Magpie uses aggregated DEX liquidity via Jupiter&apos;s Price API v2 as the
                primary oracle.
              </P>

              <H3>Oracle design</H3>
              <BulletList items={[
                "Jupiter Price API v2 aggregates liquidity across all major Solana DEXes (Raydium, Orca, Meteora)",
                "Aggregation makes price manipulation economically infeasible — an attacker would need to move prices across multiple venues simultaneously",
                "60-second quote expiry prevents stale pricing from impacting loan origination",
                "2% maximum slippage tolerance between quote and execution price",
                "Real-time price re-verification at confirmation — if price moves beyond tolerance, the transaction reverts",
              ]} />

              <H3>Risk parameters</H3>
              <Table
                headers={["Parameter", "Value", "Rationale"]}
                rows={[
                  ["Max LTV (Express)", "30%", "70% buffer before liquidation"],
                  ["Max LTV (Quick)", "25%", "75% buffer before liquidation"],
                  ["Max LTV (Standard)", "20%", "80% buffer before liquidation"],
                  ["Liquidation threshold", "1.1x health", "10% buffer above underwater"],
                  ["Quote expiry", "60 seconds", "Prevents stale price execution"],
                  ["Max slippage", "2%", "Protects against flash moves"],
                ]}
              />

              <H3>Health alerts</H3>
              <P>
                The protocol sends progressive health alerts to borrowers via Telegram:
                a warning at 90% health ratio, and a critical alert 24 hours before the
                loan due date. Each alert includes the current health ratio, collateral value,
                and suggested actions (top-up, partial repay, or full repay).
              </P>
            </Section>
          </Reveal>

          {/* ─── 7. Credit System ─── */}
          <Reveal>
            <Section id="credit" n="7" title="Credit System">
              <P>
                The Magpie Credit Score is the first DeFi credit system for memecoin lending.
                Scores range from <Strong>300 to 850</Strong> and update after every loan event
                &mdash; repayment, extension, or liquidation.
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
                    <div className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
                      {tier.benefits}
                    </div>
                  </div>
                ))}
              </div>

              <H3>Benefits of higher credit</H3>
              <BulletList items={[
                "Improved LTV ratios — borrow more against the same collateral",
                "Reduced origination fees — from 1.5% down to 1.0% at Platinum",
                "Extended loan terms available at higher tiers",
                "Priority support and early access to new features",
              ]} />
            </Section>
          </Reveal>

          {/* ─── 8. Points & Incentives ─── */}
          <Reveal>
            <Section id="points" n="8" title="Points & Incentives">
              <P>
                The Magpie Points system incentivizes engagement, responsible borrowing, and
                protocol exploration. Points accrue on every loan and can be amplified through
                positive behavior.
              </P>

              <H3>Points calculation</H3>
              <CodeBlock>{`Base Points     = Loan SOL Amount x 100
Tier Multiplier = Express 1.5x | Quick 1.25x | Standard 1.0x
Early Repayment = +25% bonus
On-Time Repay   = +10% bonus
Streak Bonus    = Up to +50% (consecutive on-time repayments)
Diversity Bonus = +5% per unique token (max +25%)
First Loan      = 500 flat bonus`}</CodeBlock>

              <H3>Example</H3>
              <Callout>
                A 1 SOL Express loan repaid early with a 3-loan streak:
                <br /><br />
                <code className="font-mono text-[13px]">
                  100 base x 1.5 tier x 1.25 early x 1.3 streak = <strong className="text-[var(--ink)]">243 points</strong>
                </code>
              </Callout>

              <H3>Redemption framework (future)</H3>
              <BulletList items={[
                "Fee discounts on future loans",
                "Exclusive access to new features and higher tiers",
                "Governance weight in protocol decisions",
                "Details to be announced as the protocol matures",
              ]} />
            </Section>
          </Reveal>

          {/* ─── 9. Security Model ─── */}
          <Reveal>
            <Section id="security" n="9" title="Security Model">
              <P>
                Security is a core design constraint, not a feature bolted on after the fact.
                Every layer of the stack is built to minimize trust assumptions and attack surface.
              </P>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { title: "Non-custodial architecture", body: "Users can export private keys anytime. Magpie never controls assets outside of pledged collateral held in loan-scoped PDAs." },
                  { title: "AES-256-GCM encryption", body: "Private keys are encrypted at rest using AES-256-GCM before storage. Keys are never stored in plaintext, never logged, never transmitted unencrypted." },
                  { title: "On-chain liquidation", body: "Liquidation is deterministic, auditable, and has no admin override. The Anchor program logic is the final authority — no multisig, no emergency pause." },
                  { title: "Open source", body: "Both the bot and site repositories are publicly available on GitHub. Anyone can audit the protocol logic, verify on-chain programs, and inspect off-chain code." },
                  { title: "Input sanitization & rate limiting", body: "All API endpoints are rate-limited. All user inputs are sanitized to prevent injection, overflow, and replay attacks." },
                  { title: "Internal audit", body: "Internal security audit completed April 2026. Zero secrets in public codebase. SSL/TLS on all external communications." },
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
          </Reveal>

          {/* ─── 10. Tokenomics ─── */}
          <Reveal>
            <Section id="tokenomics" n="10" title="Tokenomics (Future)">
              <P>
                A governance token is under active consideration. The following framework
                represents current thinking and is subject to change based on community feedback
                and regulatory guidance.
              </P>
              <BulletList items={[
                "Governance token under consideration for protocol decision-making",
                "Points may convert to governance weight, rewarding early and active users",
                "Community-driven token listing governance — holders vote on new collateral types",
                "Fee sharing mechanism for token holders aligned with protocol health",
                "Detailed tokenomics to be announced in a dedicated publication",
              ]} />
              <Callout>
                <Strong>Note:</Strong> No token has been announced or launched. This section
                reflects directional thinking only. Any token launch will be accompanied by
                a full tokenomics paper, audit, and community review period.
              </Callout>
            </Section>
          </Reveal>

          {/* ─── 11. Roadmap ─── */}
          <Reveal>
            <Section id="roadmap" n="11" title="Roadmap">
              <div className="mt-6 space-y-4">
                {ROADMAP.map((r) => (
                  <div
                    key={r.q}
                    className="flex gap-5 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] font-mono text-[10px] font-bold text-[var(--ink-soft)]">
                        {r.q.replace("20", "'")}
                      </div>
                      {r.status === "done" ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-deep)]">Done</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Soon</span>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold tracking-tight text-[var(--ink)]">{r.q}</div>
                      <div className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">
                        {r.items}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </Reveal>

          {/* ─── 12. Conclusion ─── */}
          <Reveal>
            <Section id="conclusion" n="12" title="Conclusion">
              <P>
                Magpie addresses a $50B+ gap in the Solana DeFi ecosystem by providing the first
                comprehensive lending solution for memecoin holders. Through Telegram-native UX,
                conservative risk management, on-chain enforcement, and novel credit/points systems,
                Magpie makes DeFi accessible to the largest and most active community in crypto
                &mdash; without asking them to leave their preferred platform.
              </P>
              <P>
                The protocol is live, open source, and serving borrowers today. As the ecosystem
                matures, Magpie will expand to multi-chain support, governance, and institutional
                pools &mdash; always with the same principles: simplicity, safety, and speed.
              </P>
              <div className="mt-10 flex flex-wrap gap-4">
                <a href={TELEGRAM_URL} className="btn-accent text-sm">
                  Launch Magpie Bot
                </a>
                <Link href="/docs" className="btn-ghost text-sm">
                  Read full documentation &rarr;
                </Link>
              </div>
            </Section>
          </Reveal>

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
                &larr; Back to home
              </Link>
            </div>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-[var(--hairline)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div>
              <Wordmark size={24} />
              <p className="mt-4 max-w-[220px] text-sm leading-relaxed text-[var(--ink-soft)]">
                Borrow SOL against your memecoin bags, in a Telegram chat.
              </p>
            </div>
            <FooterCol title="Product">
              <FooterLink href="/calculate">Calculator</FooterLink>
              <FooterLink href="/demo">Demo</FooterLink>
              <FooterLink href="/tokens">Approved Tokens</FooterLink>
              <FooterLink href="/dashboard">Dashboard</FooterLink>
              <FooterLink href={TELEGRAM_URL}>Telegram</FooterLink>
            </FooterCol>
            <FooterCol title="Company">
              <FooterLink href="/docs">Docs</FooterLink>
              <FooterLink href="/whitepaper">Litepaper</FooterLink>
              <FooterLink href="/security">Security</FooterLink>
              <FooterLink href="/about">About</FooterLink>
            </FooterCol>
            <FooterCol title="Social">
              <FooterLink href="https://x.com/MagpieLending">X</FooterLink>
              <FooterLink href={TELEGRAM_URL}>Telegram</FooterLink>
              <FooterLink href="#">GitHub</FooterLink>
            </FooterCol>
          </div>
          <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-[var(--hairline)] pt-6 md:flex-row md:items-center">
            <div className="text-xs text-[var(--ink-soft)]">
              &copy; {new Date().getFullYear()} Magpie &middot; Built on Solana
            </div>
            <div className="text-xs text-[var(--ink-faint)]">
              Not financial advice. Loans carry liquidation risk.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ───────────── Reusable doc components ───────────── */

function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-20 scroll-mt-28">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm text-[var(--accent-deep)]">{n}.</span>
        <h2 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
          {title}
        </h2>
      </div>
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

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="text-[var(--ink)]">{children}</strong>;
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

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-[var(--ink-soft)]">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
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

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
        {title}
      </div>
      <div className="mt-4 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]">
      {children}
    </a>
  );
}
