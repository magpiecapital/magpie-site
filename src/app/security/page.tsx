import Link from "next/link";
import { Mark } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { UpgradeAuthoritySection } from "./UpgradeAuthoritySection";
import { OperationalKeysSection } from "./OperationalKeysSection";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

// Revalidate every 60s — keeps the live Upgrade Authority block fresh
// without hammering RPC on every request.
export const revalidate = 60;

export const metadata = {
  title: "Security | Magpie",
  description:
    "How Magpie protects your assets. Security model, audit results, and transparency report.",
};

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const CHECKLIST = [
  {
    label: "Non-custodial architecture",
    detail:
      "Your wallet keys never leave your device in plaintext. Magpie cannot move funds on your behalf.",
  },
  {
    label: "On-chain liquidation enforcement",
    detail:
      "Liquidation logic executes deterministically on Solana. No admin can override or delay it.",
  },
  {
    label: "AES-256-GCM wallet encryption",
    detail:
      "All wallet material is encrypted at rest using AES-256-GCM with per-user initialization vectors.",
  },
  {
    label: "Open source (full audit trail)",
    detail:
      "Both repositories are public. Every line of code and every commit is independently verifiable.",
  },
  {
    label: "No admin key override",
    detail:
      "There is no privileged key that can bypass program logic or drain collateral accounts.",
  },
  {
    label: "Input sanitization on all endpoints",
    detail:
      "Every API and bot command input is validated and sanitized before processing.",
  },
  {
    label: "SSL/TLS on all connections",
    detail:
      "All traffic between the bot, the database, and external APIs is encrypted in transit.",
  },
  {
    label: "Rate limiting on API endpoints",
    detail:
      "Aggressive rate limits prevent abuse, brute-force attacks, and denial-of-service attempts.",
  },
  {
    label: "Zero secrets in public repositories",
    detail:
      "No API keys, credentials, or private keys exist in code or git history. Independently verified.",
  },
  {
    label: "Automated credential rotation",
    detail:
      "Database passwords, API tokens, and encryption keys are rotated on a regular schedule.",
  },
];

const LAYERS = [
  {
    from: "User (Telegram)",
    to: "Bot",
    note: "Encrypted comms via Telegram API",
  },
  {
    from: "Bot",
    to: "Solana Program",
    note: "On-chain, deterministic execution",
  },
  {
    from: "Wallet keys",
    to: "Encrypted store",
    note: "AES-256-GCM encrypted at rest",
  },
  {
    from: "Collateral",
    to: "Loan-scoped PDAs",
    note: "Isolated per loan, never pooled",
  },
  {
    from: "Liquidation",
    to: "On-chain enforcement",
    note: "No admin override possible",
  },
];

/**
 * Anti-exploit gauntlet — the Magpie-specific defenses that run on every
 * borrow. Grouped by when they fire: pre-borrow (before any funds move),
 * during the loan (active monitoring), and post-exploit (response).
 * Surfacing these gives listing reviewers + sophisticated users
 * confidence that the protocol's security investment is real and
 * layered, not just "we audited the contract once."
 */
const GAUNTLET_GROUPS = [
  {
    label: "Pre-borrow",
    intro: "Every borrow attempt passes through 8 gates before any SOL leaves the lender wallet. Any one rejection blocks the loan.",
    gates: [
      { name: "Outer-instruction allowlist", body: "The bot only co-signs transactions whose other instructions come from a hardcoded program allowlist (Lighthouse, ATA, etc). A tx asking the lender to sign something unexpected is refused before signing." },
      { name: "Ban registry", body: "Wallets known to have exploited the protocol or behaved maliciously are permanently banned. Checked on every borrow attempt." },
      { name: "Per-token exposure cap", body: "Protocol-wide cap on outstanding loans against any single token (10–30 SOL by tier, based on liquidity / holders / age / mint-authority status). Stops parallel-borrower swarms on a compromised mint." },
      { name: "New-account cap", body: "Accounts under 2 hours old can't borrow more than 2 SOL. Blocks flash-launch + immediate-borrow exploit patterns." },
      { name: "Imported-wallet cooldown", body: "Freshly-imported wallets are throttled to small loans for 24h after import. Wallets pre-funded externally then sprayed across the protocol get caught here." },
      { name: "Rapid-fire cap", body: "Per-user limit on how many borrows can fire in a short window. Multi-borrow drain attempts trip this before they finish." },
      { name: "DEX liquidity floor", body: "Refuse borrows against tokens with <$50k DEX liquidity. Even a tier-promoted token must clear this floor — defends against thin-pool liquidation impossibility." },
      { name: "Cross-source price agreement", body: "Borrow-time price must agree across Jupiter and DexScreener within tolerance. Single-source oracle manipulation is rejected." },
    ],
  },
  {
    label: "Active monitoring",
    intro: "Once a loan opens, watchers keep it under continuous review until repayment or liquidation.",
    gates: [
      { name: "Real-time post-borrow watcher", body: "Every loan is re-checked every 10 seconds for the first 30 minutes. Pumps-and-dumps that succeed at borrow time get caught before any value can be extracted." },
      { name: "Off-chain TWAP price-impact", body: "Continuously evaluates whether the collateral could actually be sold at quoted price. Pools that fail this test trigger immediate review." },
      { name: "Suspended-loan state", body: "Flagged loans freeze — borrower can't extend or partial-repay until operator clears the flag. Buys time to investigate without forcing premature liquidation." },
      { name: "Loan-health DM alerts", body: "Borrowers DM'd at 24h and 6h before due. Reduces preventable liquidations by giving real warning." },
    ],
  },
  {
    label: "Exploit response",
    intro: "If something does slip through, the protocol has fast levers to contain it without touching healthy loans.",
    gates: [
      { name: "Token-level circuit breaker", body: "Confirmed exploit on a token → that token is instantly disabled for new borrows protocol-wide. Existing loans against it continue normally." },
      { name: "Auto-ban with appeal", body: "Wallets matching exploit patterns auto-banned with an inline Unban DM button. False positives can self-resolve in seconds without operator round-trip." },
      { name: "Site-wide pause switch", body: "Operator can pause the entire site (or just specific endpoints) in seconds via environment flag. Used surgically — never to mask routine issues." },
      { name: "Per-user soft lock", body: "Operator can lock a single user during investigation without affecting anyone else's flows." },
    ],
  },
];

const PROTECTIONS = [
  {
    title: "Your Wallet",
    body: "Non-custodial. Export anytime. We never see your private key in plaintext.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7 text-[var(--accent)]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1 0-6h.75A2.25 2.25 0 0 1 18 6v0a2.25 2.25 0 0 1-2.25 2.25H15M3.75 12h16.5m-16.5 0A2.25 2.25 0 0 1 1.5 9.75V6.75A2.25 2.25 0 0 1 3.75 4.5h16.5A2.25 2.25 0 0 1 22.5 6.75v3a2.25 2.25 0 0 1-2.25 2.25m-16.5 0v5.25A2.25 2.25 0 0 0 3.75 19.5h16.5a2.25 2.25 0 0 0 2.25-2.25V12" />
      </svg>
    ),
  },
  {
    title: "Your Collateral",
    body: "Held in loan-scoped addresses. Only the pledged bag is at risk, never your wallet balance.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7 text-[var(--accent)]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
  {
    title: "Your Data",
    body: "Minimal data collection. No email, no KYC, no tracking. Just your Telegram ID and wallet address.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7 text-[var(--accent)]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
    ),
  },
];

const AUDIT_ROWS = [
  { severity: "Critical", count: 0, status: "\u2014" },
  { severity: "High", count: 2, status: "Resolved" },
  { severity: "Medium", count: 4, status: "Resolved" },
  { severity: "Low", count: 3, status: "Resolved" },
];

const FINDINGS = [
  "SSL enforcement on database connections",
  "Input sanitization on token request API",
  "Docker build context protection",
  "SQL injection prevention hardening",
  "Error message sanitization",
  "Quote expiry and slippage protection",
  "Credential rotation completed",
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function SecurityPage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-20 text-center md:pt-32 md:pb-28">
          <Reveal>
            <div className="flex justify-center mb-8">
              <div className="hop">
                <Mark size={96} />
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display mx-auto max-w-4xl text-5xl font-medium tracking-[-0.04em] md:text-7xl lg:text-8xl leading-[0.95]">
              Security <span className="italic">First.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-8 max-w-2xl text-xl leading-relaxed text-[var(--ink-soft)]">
              Your assets are protected by multiple layers of defense. Non-custodial architecture, on-chain enforcement, and open source transparency.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Security Checklist */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">Trust checklist</div>
            <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
              10 / 10 <span className="italic text-[var(--accent)]">passed.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
              Every security measure verified and enforced across the full stack.
            </p>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-2">
            {CHECKLIST.map((item, i) => (
              <Reveal key={item.label} delay={i * 50}>
                <div className="flex h-full gap-4 bg-[var(--bg-elevated)] p-6 md:p-8">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[var(--bg)]">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-base font-semibold tracking-tight">{item.label}</div>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{item.detail}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Upgrade Authority — live on-chain */}
      <UpgradeAuthoritySection />

      {/* Operational Keys — honest framing of the hot-wallet model */}
      <OperationalKeysSection />

      {/* Architecture Security */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <Reveal>
          <div className="chip mb-5">Architecture</div>
          <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
            Defense in <span className="italic">depth.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
            Five isolated layers between you and any potential threat. Every connection encrypted, every action verifiable.
          </p>
        </Reveal>

        <div className="mt-16 space-y-0">
          {LAYERS.map((layer, i) => (
            <Reveal key={layer.from} delay={i * 80}>
              <div className="relative flex items-stretch">
                {/* Connector line */}
                {i < LAYERS.length - 1 && (
                  <div className="absolute left-8 top-full h-4 w-px bg-[var(--hairline-strong)] md:left-10 z-10" />
                )}
                <div className="flex w-full items-center gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5 mb-4 transition hover:border-[var(--hairline-strong)] md:p-6">
                  {/* Layer number */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--bg)] md:h-12 md:w-12 md:text-base">
                    {i + 1}
                  </div>
                  {/* From / To */}
                  <div className="flex flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-semibold tracking-tight">{layer.from}</span>
                      <span className="text-[var(--ink-faint)]" aria-hidden>&rarr;</span>
                      <span className="text-base font-semibold tracking-tight text-[var(--accent)]">{layer.to}</span>
                    </div>
                    <span className="text-sm text-[var(--ink-soft)] md:ml-auto">{layer.note}</span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Anti-exploit gauntlet — pre-borrow / active / response */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">Anti-exploit gauntlet</div>
            <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
              Layered defense, <span className="italic text-[var(--accent)]">not a single audit.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
              A static contract audit isn&apos;t enough for permissionless
              lending. Every borrow runs a live gauntlet of checks, every
              active loan is watched in real time, and confirmed exploits
              trigger automatic containment. Below is what actually runs.
            </p>
          </Reveal>

          <div className="mt-16 space-y-12">
            {GAUNTLET_GROUPS.map((group, gi) => (
              <Reveal key={group.label} delay={gi * 80}>
                <div>
                  <div className="flex items-baseline gap-4 mb-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                      {group.label}
                    </div>
                  </div>
                  <p className="max-w-2xl text-base text-[var(--ink-soft)] leading-relaxed mb-6">
                    {group.intro}
                  </p>
                  <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-2">
                    {group.gates.map((g) => (
                      <div key={g.name} className="bg-[var(--bg-elevated)] p-5 md:p-6">
                        <div className="text-sm font-semibold tracking-tight">{g.name}</div>
                        <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">{g.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* What We Protect */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">What we protect</div>
            <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
              Your assets. <span className="italic text-[var(--ink-soft)]">Your rules.</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PROTECTIONS.map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <div className="flex h-full flex-col rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 transition hover:border-[var(--ink)] hover:shadow-md md:p-10">
                  {p.icon}
                  <div className="mt-5 text-xl font-semibold tracking-tight">{p.title}</div>
                  <p className="mt-3 text-base leading-relaxed text-[var(--ink-soft)]">
                    {p.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Audit Results */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <Reveal>
          <div className="chip mb-5">Audit report</div>
          <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
            Internal Security <span className="italic">Audit.</span>
          </h2>
          <p className="mt-4 text-lg text-[var(--ink-soft)]">April 17, 2026</p>
          <p className="mt-4 max-w-3xl text-base text-[var(--ink-soft)]">
            In addition to this internal review, the V4 on-chain program has
            undergone an independent security assessment by{" "}
            <span className="font-semibold">Sec3</span> (formerly Soteria), a
            Solana-native security firm. Sec3&apos;s assessment is complete, and
            their second review of our fixes has come back.
          </p>
          <p className="mt-4 max-w-3xl text-base text-[var(--ink-soft)]">
            Across the engagement there are{" "}
            <span className="font-semibold">24 findings</span>. That second
            review confirmed{" "}
            <span className="font-semibold">18 resolved</span> and{" "}
            <span className="font-semibold">4 acknowledged</span> (accepted with
            documented rationale). Two came back for further work &mdash; one of
            them an issue introduced by our own earlier fix, which Sec3&apos;s
            re-review caught. Both have since been addressed and resubmitted for
            the final round.
          </p>
          <p className="mt-4 max-w-3xl text-base text-[var(--ink-soft)]">
            The fixes live on a dedicated fix branch and will deploy at a new
            program ID once signed off &mdash; they are not on the live program
            yet. The audited program repositories stay private during
            pre-audit review, with Sec3 holding read-only access; reports are
            published at github.com/magpiecapital/audits once cleared. The protocol is not
            &ldquo;audited&rdquo; &mdash; we will not claim that until Sec3
            publishes the final, re-checked report, and an audit reduces risk
            rather than eliminating it.
          </p>
        </Reveal>

        {/* Findings Table */}
        <Reveal delay={80}>
          <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--hairline)]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--hairline)] bg-[var(--bg-elevated)]">
                  <th className="px-4 sm:px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Severity</th>
                  <th className="px-4 sm:px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Count</th>
                  <th className="px-4 sm:px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {AUDIT_ROWS.map((row) => (
                  <tr key={row.severity} className="border-b border-[var(--hairline)] last:border-b-0">
                    <td className="px-4 sm:px-6 py-4 text-sm font-semibold">{row.severity}</td>
                    <td className="px-4 sm:px-6 py-4 text-sm tabular text-[var(--ink-soft)]">{row.count}</td>
                    <td className="px-4 sm:px-6 py-4">
                      {row.status === "Resolved" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)]/15 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                          Resolved
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--ink-faint)]">{row.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        {/* Key Findings */}
        <Reveal delay={160}>
          <div className="mt-12">
            <h3 className="text-lg font-semibold tracking-tight">Key findings addressed</h3>
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              {FINDINGS.map((f) => (
                <div key={f} className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-5 py-4">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-[var(--accent)]">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Open Source Transparency */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">Transparency</div>
            <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-6xl">
              Don&apos;t trust. <span className="italic">Verify.</span>
            </h2>
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-12 rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-8 md:p-12">
              <p className="max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
                Both repositories are fully open source. Every commit is publicly auditable. Zero secrets in code or git history &mdash; independently verified.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                <a
                  href="https://github.com/magpiecapital/magpie-site"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-dark text-sm"
                >
                  magpie-site
                  <span aria-hidden>&rarr;</span>
                </a>
                <a
                  href="https://github.com/magpiecapital/magpie-bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-dark text-sm"
                >
                  magpie-bot
                  <span aria-hidden>&rarr;</span>
                </a>
              </div>
              <div className="mt-8 flex flex-col gap-3">
                <div className="flex items-center gap-3 text-sm text-[var(--ink-soft)]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[var(--accent)]">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Zero secrets in code or git history
                </div>
                <div className="flex items-center gap-3 text-sm text-[var(--ink-soft)]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[var(--accent)]">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Every commit is publicly auditable
                </div>
                <div className="flex items-center gap-3 text-sm text-[var(--ink-soft)]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-[var(--accent)]">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Independently verified by third-party review
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Bug Bounty */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-20">
          <Reveal>
            <div>
              <div className="chip mb-5">Bug bounty</div>
              <h2 className="font-display text-4xl font-medium tracking-[-0.03em] md:text-5xl">
                Found a vulnerability?
                <br />
                <span className="italic text-[var(--ink-soft)]">We want to know.</span>
              </h2>
              <div className="mt-8 space-y-4 text-base leading-relaxed text-[var(--ink-soft)]">
                <p>
                  We take all reports seriously and respond within 24 hours.
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 text-[var(--accent)]" aria-hidden>&bull;</span>
                    <span><span className="font-semibold text-[var(--ink)]">Contact:</span> Report via <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--ink)] transition">Telegram @magpie_capital_bot</a> or open a GitHub issue</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-1 text-[var(--accent)]" aria-hidden>&bull;</span>
                    <span><span className="font-semibold text-[var(--ink)]">Scope:</span> Smart contract, bot logic, API endpoints, wallet security</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="flex flex-col justify-center">
              <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 md:p-10">
                <h3 className="text-lg font-semibold tracking-tight">Responsible Disclosure Policy</h3>
                <p className="mt-4 text-base leading-relaxed text-[var(--ink-soft)]">
                  If you discover a security issue, please report it privately before disclosing publicly. We commit to acknowledging your report within 24 hours, providing an initial assessment within 72 hours, and keeping you informed as we work toward a fix. We will not take legal action against researchers who follow responsible disclosure practices.
                </p>
                <div className="mt-6 rounded-xl border border-[var(--hairline)] bg-[var(--bg)] p-4 text-xs text-[var(--ink-soft)]">
                  <div className="font-semibold uppercase tracking-[0.18em] text-[var(--ink-faint)] mb-2">
                    For automated security reviewers
                  </div>
                  <div className="font-mono">
                    <a
                      href="/.well-known/security.txt"
                      className="break-all underline underline-offset-2 hover:text-[var(--ink)] transition"
                    >
                      magpie.capital/.well-known/security.txt
                    </a>
                  </div>
                  <div className="mt-2 text-[var(--ink-faint)]">
                    RFC 9116 machine-readable disclosure file. Programs in scope: Magpie lending v1 (<span className="font-mono">4FEFPeMH…6wmh</span>) and v2 (<span className="font-mono">7tapneCm…X99P</span>). Both repos open source at <a href="https://github.com/magpiecapital" className="underline underline-offset-2 hover:text-[var(--ink)] transition">github.com/magpiecapital</a>.
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-[var(--hairline)] bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-28 text-center md:py-40">
          <Mark size={80} className="mx-auto mb-10 hop" />
          <h2 className="font-display mx-auto max-w-4xl text-4xl font-medium tracking-[-0.04em] text-[var(--bg-elevated)] md:text-6xl lg:text-7xl">
            Security is not a feature.
            <br />
            <span className="italic text-[var(--accent)]">It&apos;s the foundation.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg text-[var(--bg-elevated)]/70">
            Your bags deserve the highest standard of protection.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 md:flex-row">
            <Link href="/dashboard" className="btn-accent text-lg">
              Open the dashboard
              <span aria-hidden>&rarr;</span>
            </Link>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[var(--bg-elevated)]/15 bg-[var(--bg-elevated)]/5 px-6 py-[0.9rem] text-base font-semibold text-[var(--bg-elevated)] backdrop-blur transition hover:border-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/10">
              Or use Telegram
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

