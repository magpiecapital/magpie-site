import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { StatusDot } from "@/components/icons";
import { Footer } from "@/components/Footer";
import { getTokenStats } from "@/lib/db";

export const revalidate = 60;

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
  { id: "v4-in-vault", label: "V4 In-Vault Auto-Sells" },
  { id: "pricing-oracles", label: "Pricing & Oracles" },
  { id: "fee-structure", label: "Fee Structure" },
  { id: "credit-system", label: "Credit System" },
  { id: "security-model", label: "Security Model" },
  { id: "wallet-model", label: "Wallet Model" },
  { id: "supported-tokens", label: "Supported Tokens" },
  { id: "api-integration", label: "API & Integration" },
  { id: "agents-x402", label: "Agents & x402" },
  { id: "governance", label: "Governance" },
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

export default async function DocsPage() {
  const tokenStats = await getTokenStats().catch(() => ({ count: 64 }));
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
            <div className="mt-6 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-4">
              <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-1">Reading the deeper version?</div>
              <a
                href="/whitepaper"
                className="text-sm font-semibold text-[var(--ink)] hover:text-[var(--accent-deep)] transition"
              >
                📄 Magpie Whitepaper →
              </a>
              <div className="mt-1 text-[12px] text-[var(--ink-soft)] leading-snug">
                Full architecture, tokenomics, fee distribution, roadmap.
              </div>
            </div>
            <div className="mt-6 border-t border-[var(--hairline)] pt-6">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
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
                  body: "User selects a tier. Memecoin tiers: Express (30% LTV, 2 days), Quick (25% LTV, 3 days), Standard (20% LTV, 7 days). RWA tiers (v3): Express (50% LTV, 7 days, 2.5% fee), Quick (60% LTV, 15 days, 3.5% fee), Standard (70% LTV, 30 days, 5% fee). Oracle pricing via Jupiter API values the collateral in SOL and generates a quote.",
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

          {/* ─── V4 In-Vault Auto-Sells ─── */}
          <Section id="v4-in-vault" title="V4 In-Vault Auto-Sells" chip="New">
            <P>
              Take-profit, stop-loss, ladders, trailing stops &mdash; they fire
              on-chain into your loan&apos;s vault, the loan stays open, and
              proceeds reach your wallet only when you repay.
            </P>
            <P>
              V4 is a parallel lending program that changes how auto-sells
              (take-profit, stop-loss, bracket, ladder) settle. When a borrow
              has any auto-sell attached at borrow time, the loan
              automatically routes to V4 instead of V1 or V3.
            </P>
            <P>
              <strong>What stays the same:</strong> tier ladders (memecoin
              30/25/20% LTV, RWA 50/60/70% LTV), origination fees, due dates,
              health monitoring, liquidation rules. V4 is a different sell
              path, not a different loan economics model.
            </P>
            <P>
              <strong>What&apos;s different:</strong> when a leg fires, the
              engine calls a new on-chain instruction
              <code> convert_collateral_slice</code> which sells the slice
              percentage via a caller-assembled Jupiter CPI and parks the SOL
              proceeds <em>inside the loan&apos;s per-loan vault</em>. The
              SOL does NOT go to the borrower&apos;s wallet. The loan stays
              <strong> Active</strong>. The borrower decides when to close.
              When they /repay, they receive both any remaining collateral
              AND the accumulated vault SOL in the same atomic transaction.
            </P>
            <P>
              <strong>Why this matters:</strong> V4 gives users
              brokerage-style stop semantics on-chain. Tax-timing control
              (choose when to realize). Hold-vs-close control (decide after
              the auto-sell whether to repay or wait). No forced loan close
              at fire time.
            </P>
            <P>
              <strong>Ladder economics:</strong> V4 ladders are
              significantly cheaper than legacy V1/V3 ladders. V4 charges a
              flat 1% protocol fee per leg with NO per-leg origination fee.
              A 4-leg V4 ladder costs roughly 4% in protocol fees over its
              lifetime. The legacy V1/V3 ladder model re-borrows the
              remainder after each leg fires and pays the tier&apos;s
              origination fee on each re-borrow — a 4-leg ladder on RWA
              Standard charges ~20% cumulative.
            </P>
            <P>
              <strong>Repay funding note:</strong> V4 requires the full owed
              amount in liquid SOL in the borrower&apos;s wallet at close
              time. The vault SOL flows back in the same transaction but
              does NOT pre-pay the loan. Plan to keep approximately the LTV
              amount of SOL liquid through the life of any V4 loan with
              armed exits.
            </P>
            <P>
              <strong>Slice math:</strong> Each leg sells
              <code> slice_bps × original_collateral / 10000</code> on-chain.
              Slice percentages refer to the ORIGINAL collateral, not the
              remaining amount. A ladder of 90% + 10% will sell exactly the
              original collateral (no over-sell). A ladder summing to less
              than 100% leaves the unsold portion as remaining collateral.
            </P>
            <P>
              <strong>Existing V1/V3 loans are unaffected.</strong> V4
              is a parallel deploy at
              <code className="break-all"> HA1hgvskN1goEsb33rNHFBcDXBaYyLyyqfGwGMgTUwNo</code>.
              Legacy loans continue to repay, extend, partial-repay, top up,
              and liquidate against their original programs unchanged. Only
              NEW borrows with exits attached route to V4.
            </P>
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

            <H3>Where the fees go (MGP-001 ratified)</H3>
            <P>
              Every loan origination + extension fee enters a four-channel split that the
              community voted in via MGP-001. The split is enforced live in the bot&apos;s
              fee accrual code and visible on /stats:
            </P>
            <Table
              headers={["Channel", "Share", "Mechanism"]}
              rows={[
                ["$MAGPIE holders",   "70%", "Accrues to a holder pool; distributed periodically by snapshot of on-chain balances."],
                ["SOL LPs",           "10%", "Accrues to LP loyalty pool; weighted by time-of-deposit so flippers earn near-zero."],
                ["Referrers",         "10%", "Accrues per referred borrower; users claim via /claim on demand."],
                ["Protocol reserve",  "10%", "Counter-cyclical buffer — covers bad-debt, emergency fixes, lender backstop. Spend is manual + governance-visible."],
              ]}
            />

            <H3>Distribution flow (and why one wallet appears on Bubblemaps)</H3>
            <P>
              The $MAGPIE holder share is distributed via on-chain SOL transfers from a
              protocol-owned <em>distributor wallet</em>. The wallet is funded by the
              protocol&apos;s lender authority each snapshot, then broadcasts pro-rata SOL
              to every eligible holder. The cadence is intentionally random within a 5-10
              day window per snapshot so mercenary holders cannot time
              buy-just-before / dump-just-after a distribution.
            </P>
            <P>
              On Bubblemaps and similar concentration tools, this distributor wallet shows
              up as a hub with many recipients — at a glance, that can read as
              &ldquo;one entity controls X% of the graph.&rdquo;{" "}
              <strong>It does not.</strong> The distributor wallet holds zero $MAGPIE, has
              no token authority, and is purely a passthrough for fee revenue accruing to
              existing holders.
            </P>
            <Callout>
              <strong>How to verify (with the wallet address):</strong>{" "}
              The distributor wallet is{" "}
              <code className="font-mono text-xs break-all">CHCAMWtnmgyjsJqHcq5MdeDdg4X3Ux1XAwA2rMCXj1Ac</code>.
              Open it on{" "}
              <a
                href="https://solscan.io/account/CHCAMWtnmgyjsJqHcq5MdeDdg4X3Ux1XAwA2rMCXj1Ac"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Solscan
              </a>{" "}
              and confirm the SPL token list is empty — it holds zero $MAGPIE, zero
              anything. Its only activity is outgoing SOL transfers to holder wallets
              during snapshot distributions. The Bubblemaps cluster you may see is
              this receiver-graph — NOT a token-supply concentration. Live accruing +
              distributed totals on{" "}
              <a href="/stats" className="underline">/stats</a>.
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
            <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--hairline)]">
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
              Magpie currently supports <strong>{tokenStats.count}+ Solana tokens</strong> as loan
              collateral. Anyone can submit a new token — either via{" "}
              <span className="font-mono">/submit</span> in the bot or at{" "}
              <a href="/submit" className="font-medium text-[var(--accent-deep)] underline underline-offset-2 hover:text-[var(--accent)]">magpie.capital/submit</a>.
              The screener runs a 6-layer safety audit + market evaluation and returns one of three outcomes.
            </P>

            <H3>Submission outcomes</H3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-500">✅ Instant Approval</div>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">
                  Passes every audit AND hits auto-approve bar (≥$75K liq, ≥$50K 24h vol, ≥$100K mcap, ≥300 holders, ≥24h old, LP burned, mint/freeze authority revoked, top-10 ≤40%). Live as collateral within seconds.
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500">
                  <StatusDot className="h-2 w-2" />
                  <span>Needs Review</span>
                </div>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">
                  Safe (passes every audit) but below auto-approve bar — usually too young, thin liquidity, or low 24h volume. Queued for team review, typically within an hour.
                </p>
              </div>
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-500">❌ Declined</div>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">
                  Failed a safety gate (honeypot, mint/freeze authority active, ≥40% top-10 concentration, LP not burned, RugCheck flag, symbol impersonation) or below minimum thresholds. Fix the issue and resubmit.
                </p>
              </div>
            </div>

            <H3>The 6-layer safety audit (every submission)</H3>
            <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-[var(--ink-soft)]">
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span><strong>Sellability test</strong> — on-chain swap simulation; honeypots fail here</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span><strong>Token-2022 extension audit</strong> — check transfer hooks, fees, permanent delegate</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span><strong>Holder concentration</strong> — top-10 holders ≤ 40% of supply</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span><strong>RugCheck risk score</strong> — third-party aggregated risk feed</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span><strong>Symbol impersonation guard</strong> — block fake variants of approved tokens</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--ink)]" />
                <span><strong>Cooldown + minimums</strong> — ≥4h old, $5K+ liq, $500+ 24h volume to even be considered</span>
              </li>
            </ul>

            <p className="mt-6 text-[15px] leading-relaxed text-[var(--ink-soft)]">
              <Link href="/submit" className="font-medium text-[var(--accent-deep)] underline underline-offset-4 hover:text-[var(--accent)]">
                See the full submission guide →
              </Link>
            </p>

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

          {/* ─── Delegated agent take-profit ─── */}
          <Section id="agents-x402" title="Delegated agent take-profit" chip="Programmatic">
            <Callout>
              <strong>This section covers one specific mode:</strong> an agent
              arming a take-profit on <em>someone else&apos;s</em> loan via a
              signed delegation. For the main agent surface — an agent that
              borrows against its <em>own</em> assets, arms its own exits, and
              repays, all paid per call over x402 — see the{" "}
              <a href="/x402" className="font-medium underline">x402 page</a>.
            </Callout>
            <P>
              Magpie exposes a paid agent surface for autonomous take-profit
              orders. Agents (other on-chain programs, bots, or AI orchestrators)
              can arm a take-profit on a borrower&apos;s loan after that borrower
              explicitly delegates the capability via a signed delegation record.
              The delegation is bounded &mdash; agents cannot widen slippage past
              the borrower&apos;s stated max, cannot extend the agreed expiry,
              cannot fire on a loan that wasn&apos;t named.
            </P>

            <H3>Delegation model</H3>
            <P>
              Before any agent can arm an order, the borrower writes an
              <code className="mx-1 rounded bg-[var(--surface)] px-1 font-mono text-[12px]">agent_delegations</code>
              row signing over the agent&apos;s public key, the maximum slippage
              the agent is allowed to request, and an expiry. The bot
              re-verifies that signature server-side and refuses to accept any
              arm request from an agent without a valid, unexpired delegation.
            </P>
            <Table
              headers={["Field", "Bounds", "Enforced by"]}
              rows={[
                ["agent_pubkey", "Ed25519 public key (32 bytes)", "Borrower signature over delegation"],
                ["max_slippage_bps", "10..5000 (0.1% to 50%)", "Server-side CHECK + arm gate"],
                ["expires_at", "ISO timestamp, up to 1 year out", "Arm gate rejects expired delegations"],
                ["sell_destination", "sol or usdc (frozen at delegate time)", "Engine reads from delegation, not agent payload"],
              ]}
            />

            <H3>Signed envelopes</H3>
            <P>
              Every arm and cancel request carries an Ed25519 signature over a
              canonical envelope, with an action-bound header so an arm
              signature cannot be replayed against the cancel endpoint and
              vice versa. Replay window is bounded to 5 minutes from the
              client clock; a 10s per-(agent, action) rate limit further
              blocks burst replays.
            </P>
            <CodeBlock>{`POST /api/v1/internal-agent-limitclose

Headers:
  Content-Type: application/json
  x402-version: 1
  x-magpie-action: magpie: limit-close-arm/v1   ← action binding (REQUIRED)

Body (canonical JSON, no extra whitespace):
{
  "from": "<agent_pubkey_base58>",
  "issued_at": "<RFC3339 ISO timestamp>",
  "borrower": "<borrower_wallet_base58>",
  "loan_id_chain": "<u64 string>",
  "target": {
    "kind": "multiplier" | "price_usd" | "mc_usd",
    "multiplier": 2,                      ← or
    "price_usd_micro": "5000",            ← or
    "mc_usd_micro": "150000000"
  },
  "slippage_bps": 200,
  "signature_base58": "<sig over (action_header || canonical_body)>"
}`}</CodeBlock>

            <H3>Endpoints</H3>
            <Table
              headers={["Action", "Endpoint", "Action header"]}
              rows={[
                ["Arm", "POST /api/v1/internal-agent-limitclose", "magpie: limit-close-arm/v1"],
                ["Cancel", "DELETE /api/v1/internal-agent-limitclose/:order_id", "magpie: limit-close-cancel/v1"],
                ["List own armed orders", "GET /api/v1/agent/orders?agent_pubkey=...", "magpie: agent-orders-list/v1"],
              ]}
            />

            <H3>Pricing (x402)</H3>
            <P>
              Arming a take-profit costs 0.001 SOL paid through an x402 receipt
              attached to the request. The arm is rejected if the receipt is
              invalid, double-spent, or insufficient. List + cancel are free
              (delegation already paid for the relationship).
            </P>

            <H3>Fill-guarantee stack</H3>
            <P>
              The same five-layer execution stack as human-armed orders applies
              to agent-armed orders. The borrower is the on-chain signer either
              way; the agent is the dispatcher.
            </P>
            <Table
              headers={["Layer", "Behavior"]}
              rows={[
                ["1. Initial slippage", "Starts at agent-requested value (must be <= delegation max)"],
                ["2. Auto-escalation", "1.5x per revert toward delegation max (the cap, never above)"],
                ["3. TWAP fallback", "If single-block won't fit at cap, slice into 4 chunks over ~2 min"],
                ["4. Borrower intervention", "If layers 1-3 fail, the borrower (NOT the agent) gets a Telegram DM with Allow / Wait / Cancel — agents cannot widen the cap, only the borrower can"],
                ["5. SOL reserve top-up", "Engine front-funds the borrower wallet with ~0.03 SOL for tx fees if low, reclaimed at settlement"],
              ]}
            />

            <H3>Error codes</H3>
            <Table
              headers={["Code", "Cause", "Recovery"]}
              rows={[
                ["invalid_delegation_signature", "Delegation signature doesn't match", "Re-write delegation; agent may have rotated keys"],
                ["delegation_expired", "Expiry passed", "Borrower re-issues delegation"],
                ["delegation_not_found", "No delegation for this agent + borrower pair", "Borrower must write delegation first"],
                ["slippage_exceeds_delegation_max", "Agent asked for > delegation cap", "Reduce slippage_bps or have borrower widen max"],
                ["invalid_signature", "Envelope signature doesn't verify", "Check canonical-JSON encoding + action header"],
                ["envelope_replayed_or_stale", "issued_at older than 5 min or signature seen before", "Re-sign with fresh timestamp"],
                ["loan_not_found_for_borrower", "Loan id doesn't belong to the borrower in the delegation", "Confirm borrower owns the loan"],
                ["loan_already_has_active_order", "An order is already armed on this loan", "Cancel existing first"],
                ["preflight_insufficient_liquidity", "Even at delegation max, no Jupiter route clears the loan + fee", "Wait for deeper liquidity or have borrower repay manually"],
                ["x402_receipt_invalid", "Payment receipt missing, malformed, or replayed", "Attach fresh valid receipt"],
              ]}
            />

            <H3>Intervention semantics for agents</H3>
            <P>
              When an order enters Layer 4 (the borrower-decision DM), the
              agent does not get a callback. The borrower&apos;s response is
              authoritative: Allow widens the cap one-shot for that order
              only, Wait pauses for 15 minutes, Cancel terminates the order.
              Agents can poll the order status endpoint to learn the outcome
              and re-arm on a new loan if appropriate.
            </P>
          </Section>

          {/* ─── Governance ─── */}
          <Section id="governance" title="Governance" chip="v0">
            <P>
              $MAGPIE holders influence protocol direction through off-chain
              signal voting on a narrow, explicit set of levers. The operator
              commits to honor passing votes within scope. The full canonical
              spec is at{" "}
              <a
                href="https://github.com/magpiecapital/magpie-site/blob/main/GOVERNANCE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--accent-deep)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
              >
                GOVERNANCE.md
              </a>
              ; the public page lives at{" "}
              <Link
                href="/governance"
                className="font-semibold text-[var(--accent-deep)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
              >
                magpie.capital/governance
              </Link>
              ; and the machine-readable model is at{" "}
              <Link
                href="/api/v1/governance"
                className="font-semibold text-[var(--accent-deep)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
              >
                /api/v1/governance
              </Link>
              .
            </P>

            <H3>Voting power</H3>
            <P>
              1 token = 1 vote. Voting weight per wallet equals the wallet&apos;s
              $MAGPIE balance at the time of proposal activation. DEX pool
              token accounts (PumpSwap, Meteora), the Magpie operator wallet,
              and the burn / system address are excluded from the weight
              calculation &mdash; they hold $MAGPIE for non-voter reasons.
            </P>

            <H3>Tier A &mdash; what holders can vote on</H3>
            <Table
              headers={["#", "Topic", "Bounds"]}
              rows={[
                ["A1", "Add or remove a collateral token", "Must clear screener risk thresholds; one token per proposal"],
                ["A2", "Adjust tier LTV cap", "Within ±5 percentage points of current; per tier"],
                ["A3", "Adjust tier fee rate", "Within ±0.5 percentage points of current"],
                ["A4", "Adjust holder distribution share of loan fees", "Within 5%–15% per tier-A vote (currently 70% via the one-time MGP-001 exception ratified 2026-06-13); future loans only"],
                ["A5", "Adjust holder distribution cadence", "Within 3–14 days (currently randomized 5–10)"],
                ["A6", "Non-binding signal poll on feature priorities", "Advisory only"],
              ]}
            />
            <P>
              The operator commits to implement a passing Tier A vote within
              14 days. Vetoing a passing Tier A vote within bounds is a
              one-strike trust event documented in the governance spec.
            </P>

            <H3>Tier B &mdash; out of scope (operator discretion)</H3>
            <P>
              These cannot be put to a vote in v0. Listed explicitly so the
              boundary is unambiguous:
            </P>
            <Table
              headers={["Topic", "Why"]}
              rows={[
                ["Retroactive changes to active loans", "Loan terms are a contract between borrower and protocol at borrow time"],
                ["On-chain safety configuration", "Security gauntlet, oracle config, anti-exploit gates"],
                ["Founder identity or operational security", "Operator anonymity is part of the security model"],
                ["Treasury / lender-wallet allocation", "Holds operational SOL liquidity, not governance funds"],
                ["Token supply changes", "Mint authority revoked; supply is fixed"],
                ["Pricing or scope of the x402 paid agent API", "Operator discretion"],
              ]}
            />

            <H3>Proposal lifecycle</H3>
            <StepList
              steps={[
                {
                  n: "1",
                  title: "Draft (community)",
                  body: "Anyone posts a proposal idea in the @magpietalk community group. Include the scope tier (A1–A6), exact change requested, rationale (≤500 words), and expected protocol impact. Operator reviews drafts within 7 days; scope-rejected drafts remain visible so the community can iterate.",
                },
                {
                  n: "2",
                  title: "Active (voting opens)",
                  body: "Operator pins the proposal at /governance. Holders connect wallet at /governance/proposal/[id] and vote YES / NO / ABSTAIN. Votes are wallet-signed off-chain messages — gasless and anonymous beyond the pubkey. The operator publishes the aggregate result at vote close; per-wallet vote choices are not published.",
                },
                {
                  n: "3",
                  title: "Closed (tally + threshold check)",
                  body: "At close, the tally is computed. Binary parameter votes use a 3-day window: quorum is 5% of eligible supply (excluding the excluded-address list) voting YES + NO, and the pass threshold is 60% YES of (YES + NO); abstain counts toward neither. Multi-choice allocation votes (e.g. MGP-003) use a 5-day window, a 7.5% quorum, and a winning option above 40% of votes cast (plurality).",
                },
                {
                  n: "4",
                  title: "Executed (operator implements)",
                  body: "Operator implements the passing change within 14 days. On-chain changes ship as transactions with public signatures. Configuration changes ship as commits with the proposal ID in the commit message.",
                },
              ]}
            />

            <H3>Roadmap</H3>
            <Table
              headers={["Version", "Status", "Mechanism"]}
              rows={[
                ["v0", "current", "Off-chain signal voting; operator commits to honor passing Tier A votes within 14 days"],
                ["v1", "planned", "On-chain configuration contract enforces Tier A parameter bounds — operator cannot change LTV / fees / holder share outside the bounds without a new contract deploy"],
                ["v1.5", "shipped 2026-06-18", "Program upgrade authority migrated from a single hot key to a hardware-key Squads V4 multisig with a 48-hour public timelock and an immutable configuration. See /security for live verification."],
                ["v2", "planned", "Full on-chain governance (SPL governance program or equivalent); token-weighted on-chain votes; remaining operator-discretion parameters move to on-chain governance"],
              ]}
            />
            <P>
              No timeline commitments on v1 or v2 &mdash; the model evolves as
              the protocol&apos;s track record warrants it. The direction is
              one-way: less operator discretion, never more.
            </P>
          </Section>

          {/* Bottom spacer */}
          <div className="mt-20 border-t border-[var(--hairline)] pt-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-[var(--ink-soft)]">
                Questions? Reach out on{" "}
                <a
                  href={TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
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

