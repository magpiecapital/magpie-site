import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Changelog | Magpie",
  description:
    "What's new at Magpie. Protocol updates, new features, and improvements.",
};

type Tag = "Feature" | "Improvement" | "Security" | "Launch" | "Migration" | "Privacy" | "Governance";

interface Entry {
  date: string;
  tag: Tag;
  title: string;
  bullets: string[];
}

const ENTRIES: Entry[] = [
  {
    date: "June 14, 2026",
    tag: "Feature",
    title: "Defaulted-loan profit goes to the rewards pool",
    bullets: [
      "When a non-$MAGPIE collateralized loan defaults, the protocol seizes + sells the collateral, recovers its lent principal, and routes the NET PROFIT (sale proceeds minus principal) directly into the next reward distribution. Same 70/10/10/10 split as the fee-side accrual: 70% $MAGPIE holders, 10% LP loyalty, 10% referrer, 10% protocol reserve. When the defaulting borrower had no referrer, the 10% referrer slice rolls back into the holder slice — so holders effectively get 80%",
      "When $MAGPIE is the collateral, the seized $MAGPIE is burned on-chain (operator-conducted) instead of sold — same model as before, now formally codified",
      "Real-time totals on /stats (Telegram) under DEFAULTED-LOAN PROFIT, and on magpie.capital/stats in the defaultedLoanProfit field — visible to anyone, no auth required",
      "Per-user dashboard estimates automatically reflect the new accrual: when a default profits the pool, every holder's 'Next Payout' number updates inside one ledger read",
      "One ledger across the protocol — TG, site, dashboard, and the distributor itself all read the same magpie_holder_pool.accrued_lamports field, so the numbers are always in sync",
    ],
  },
  {
    date: "June 14, 2026",
    tag: "Feature",
    title: "Trailing stops, brackets, and full Pip coverage for downside protection",
    bullets: [
      "Trailing stops — set a distance (e.g. 10%) and the floor floats UP with each new high, never down. Fires when price retraces that distance from the most recent peak. Available via /trailingstop in Telegram, the dashboard TakeProfitCard checkbox, and Pip (\"set a trailing 10% on my loan\")",
      "Brackets — one command arms BOTH a take-profit and a stop-loss on the same loan. First leg to fire closes the loan and auto-cancels the other. /bracket 1234 tp=2x sl=0.7x in Telegram, a \"Bracket (both)\" inline button on every funded-loan card, and a /cancelbracket companion",
      "/modifyorder gains trailing= — convert a regular stop-loss into a trailing stop in place (no cancel-and-rearm gap) or back to fixed. Floor reseeds from live price on first enable",
      "Pip now has propose_stop_loss (was a coverage gap), propose_trailing_stop, and simulate_trailing_stop (projects worst-case net SOL if the initial floor fires) — Pip can resolve any protection conversation end-to-end with concrete numbers",
      "/limitorders surfaces a TRAIL N% pill and the live peak so users can see what the floating floor is tracking",
      "/lc-perf admin telemetry now slices trailing fire rate independently from fixed-SL fire rate and counts currently-active brackets + historical bracket events",
    ],
  },
  {
    date: "June 9, 2026",
    tag: "Governance",
    title: "Magpie Governance v0 — off-chain signal voting for $MAGPIE holders",
    bullets: [
      "Published the v0 governance model at magpie.capital/governance (and the canonical spec in GOVERNANCE.md)",
      "Tier A — votable now: collateral additions/removals, tier LTV caps (±5pp), tier fee rates (±0.5pp), holder distribution share (5-15%), distribution cadence (3-14 days), and non-binding signal polls on feature priorities",
      "Tier B — out of scope: anything affecting active loans retroactively, on-chain safety config, founder identity, treasury allocation, token supply changes, x402 pricing",
      "1 token = 1 vote. Voting weight is based on $MAGPIE balance at proposal activation. DEX pools, operator wallet, and burn addresses are excluded from the weight calculation",
      "Voting is gasless — wallet-signed off-chain messages. Aggregate tallies are published at vote close; per-wallet vote choices are not",
      "3-day voting window, 5% quorum, 60% pass threshold. Passing votes implemented by the operator within 14 days",
      "Roadmap: v1 introduces an on-chain parameter-bounds contract so the operator cannot change Tier A values outside the bounds; v2 is full on-chain governance",
      "Machine-readable model at /api/v1/governance for agents and integrators. Drafts and discussion in @magpietalk",
    ],
  },
  {
    date: "June 8, 2026",
    tag: "Migration",
    title: "Site-first protocol — borrow, repay, extend, topup, chat with Pip — all without Telegram",
    bullets: [
      "Auto-bootstrap on first wallet connect — magpie.capital creates your Magpie identity automatically. No /link <code>, no @username, no Telegram step required to start transacting",
      "Dashboard now ships Repay / Extend / Top up buttons on every active loan card (was feature-flagged off; now production-stable)",
      "Pip chat streams tokens live (typing-as-it-generates) instead of pausing for the full response. First characters appear in ~300-500ms",
      "Pip's panel widened on desktop and fills viewport on mobile; markdown tables now have proper cell padding, horizontal-scroll fallback, and tabular-numeric alignment",
      "Pip is scoped to the connected wallet only — won't reference your other linked wallets unless you explicitly ask for your full account picture",
      "Every site action (borrow / repay / extend / topup) now feeds the activity feed, /stats lifetime totals, credit score, and on-time streak immediately via a new sync-loan endpoint — no waiting on the every-5-min reconciler",
      "Telegram is now framed as an optional backup surface across the site (landing, calculator, holders, credit, dashboard) — never required. The TG bot continues to work exactly as before for users who prefer it",
    ],
  },
  {
    date: "June 8, 2026",
    tag: "Privacy",
    title: "Telegram handles never exposed in public API responses",
    bullets: [
      "Stripped telegram_username from /api/v1/link/status, /api/v1/dashboard, and /api/v1/credit/leaderboard — anyone with a wallet pubkey could previously curl those endpoints and learn the owner's TG handle",
      "Leaderboard now displays a short wallet-pubkey prefix instead of @handle — keeps competitive recognition without leaking identities",
      "/api/v1/debug/recent-errors is now token-gated (operator-only). Previously anyone could harvest live error contexts including wallet pubkeys + loan PDAs",
      "Auto-bootstrap and backfill endpoints are per-IP rate-limited to prevent DoS / DB-bloat attacks",
      "New startup self-check refuses to boot the bot if any public-route handler regressively exposes telegram_username (defensive privacy lint)",
    ],
  },
  {
    date: "June 8, 2026",
    tag: "Improvement",
    title: "$MAGPIE holder rewards now credit collateralized tokens",
    bullets: [
      "If you borrow against $MAGPIE on Magpie, your locked collateral now COUNTS toward holder reward distributions",
      "Previously, collateralized $MAGPIE was filtered out by the contract-account-exclusion sweep (designed to stop AMM pools / DEX vaults from siphoning rewards), which silently punished the exact users most engaged with the protocol",
      "Defensive ordering: the locked amount is added BEFORE the PDA filter runs, so real user wallets get credited while any hypothetical PDA borrower would still be excluded",
      "Borrowing against $MAGPIE is strictly additive to your holder yield now — never punitive",
    ],
  },
  {
    date: "June 8, 2026",
    tag: "Launch",
    title: "Conditional borrows — first agent-native limit orders for borrows on Solana",
    bullets: [
      "Agents POST a borrow intent specifying a trigger — price_above, price_below, time_after, or pool_liq_above — and Magpie's watcher polls live cross-sourced DEX prices every 30 seconds in the background",
      "When the trigger fires, the server re-runs the FULL anti-exploit gauntlet with fresh state, then builds the unsigned tx and stores it. Agent polls, signs, and submits whenever it next checks in",
      "All gates apply at MATCH TIME, not creation time — a banned wallet posting an intent before the ban is still blocked when the watcher fires",
      "Postgres advisory lock ensures single-instance execution even across multiple bot replicas — no double-builds, no double-loans",
      "SDK surface: createBorrowIntent(), getIntent(), cancelIntent(), listIntents(), waitForIntent() — the last one blocks until the watcher fires and returns the on-chain signature",
      "MCP exposes magpie_create_borrow_intent + magpie_wait_for_intent — your Claude / Cursor / Cline agent can now place borrow orders that fire while you sleep",
      "Pricing: 0.01 SOL to create an intent (one payment covers the entire watching + final build lifecycle, up to 30 days). Polling 0.0005 SOL, listing 0.001 SOL, cancellation free",
    ],
  },
  {
    date: "June 8, 2026",
    tag: "Improvement",
    title: "Gold + Platinum outstanding-loan ceiling raised to 30 SOL",
    bullets: [
      "Max outstanding aggregate per user (across all linked wallets) bumped from 20 SOL → 30 SOL for Gold (score ≥650) and Platinum (≥750) tiers",
      "Max per-single-loan unchanged at 10 SOL — the bump is purely for users running multiple concurrent loans simultaneously",
      "Bronze and Silver unchanged at 10 SOL outstanding",
      "Trusted-borrower signal — the bump is a reward for sustained on-time repayment history at the higher tiers",
    ],
  },
  {
    date: "June 7, 2026",
    tag: "Security",
    title: "Multi-layer exploit defense + on-chain TWAP program (v3)",
    bullets: [
      "Ten-layer pre-borrow gauntlet now runs on every loan: ban registry (user/wallet/funder graph), per-token open cap, imported-wallet cooldown, new-account cap, rapid-fire cap, pool-pct cap, $50k live-liquidity floor, off-chain TWAP (spot ≤ trailing 30-min avg + 15%), Jupiter↔DexScreener cross-source agreement (≤5%), and a v2-pool RWA-only hard guard",
      "Token screener tightened: $25k minimum liquidity (was $5k), mandatory holder lookup, time-based review-queue auto-promote KILLED (was the root cause of one approval that should never have happened)",
      "RWA classification now requires positive issuer ID — a memecoin name alone (\"Tesla\", \"Nvidia\") no longer routes to the RWA pool",
      "Auto-detector running every 60s + fast-lane every 10s on fresh loans: multi-signal match → auto-bans user + linked wallets + traced funder wallets + suspends loans + disables the collateral mint, with one-tap admin Undo button",
      "magpie-lending-v3 — parallel on-chain Anchor program with TWAP price validation (32-sample rolling buffer, 30-min window, refuses borrows when spot > TWAP + 15%). Replaces single-spot oracle; v1 and v2 stay deployed for existing loans",
    ],
  },
  {
    date: "June 7, 2026",
    tag: "Launch",
    title: "magpie-x402 — agent-native lending API live at /x402",
    bullets: [
      "AI agents pay in SOL to query our on-chain lending protocol — credit scores, loan history, pool stats, borrow simulation",
      "No API keys, no accounts, no custody. Agents sign x402 payment proofs from their own wallets — pure HTTP 402 standard",
      "Targets the agent-spending tailwind: as autonomous machine-to-machine commerce grows, this opens a new consumer market for the Solana permissionless lending space",
      "First paid lending API on Solana. Source open at github.com/magpiecapital/magpie-x402",
    ],
  },
  {
    date: "June 7, 2026",
    tag: "Feature",
    title: "Gold + Platinum borrowers unlock higher outstanding ceiling (up from 10)",
    bullets: [
      "Credit-score tier now directly upgrades your loan-cap ceiling — Gold (score ≥650) and Platinum (≥750) borrowers initially unlocked up to 20 SOL outstanding (previously capped at 10). Subsequently raised to 30 SOL on June 8.",
      "Max per-loan size also bumped to 10 SOL at Gold/Platinum (from 5 SOL)",
      "Bronze and Silver tiers unchanged — still 5 SOL per loan / 10 SOL outstanding at their trusted ceiling",
      "Best-of qualification: a high-credit user gets the upgrade immediately without needing to accumulate the legacy 3-on-time-repay threshold",
      "Pure off-chain config change — every existing loan unchanged on-chain",
    ],
  },
  {
    date: "June 6, 2026",
    tag: "Improvement",
    title: "Protocol Copy & Cadence Consistency Sweep",
    bullets: [
      "Holder rewards cadence is now correctly described as a randomized 5–10 day window everywhere on the site (previously said \"weekly\" in two places)",
      "Dashboard no longer claims it's \"read-only\" — every loan action (repay, partial repay, extend, top up) ships on the site",
      "Pip's system prompt updated so it matches the user's current surface (suggests dashboard buttons on the site, slash commands in the bot)",
      "/docs Supported Tokens section now mentions magpie.capital/submit alongside the bot path",
    ],
  },
  {
    date: "June 2026",
    tag: "Feature",
    title: "Site Borrow / Repay / Extend / Top Up — End-to-End on the Dashboard",
    bullets: [
      "Take out new loans directly from the dashboard — no Telegram required",
      "Repay (full or partial via slider), Extend, and Top Up buttons on every active loan",
      "Withdraw SOL from the custodial bot wallet via the dashboard",
      "Server-side lender co-signing endpoint signs the protocol-authority half of every borrow",
      "Same on-chain program as Telegram — pick whichever surface fits the moment",
    ],
  },
  {
    date: "June 2026",
    tag: "Improvement",
    title: "Multi-Wallet Scoping — Holdings & Loans Stay Separated",
    bullets: [
      "Loans and holdings now show ONLY the active wallet, not everything across all linked wallets",
      "Linked wallets still aggregate for credit-score and points (intentional — that's why they're linked)",
      "Wallet switcher in the wallets section + a one-tap action menu (Borrow, Loans, Top up, Extend, Ask Pip) per wallet",
      "Wallet removal now uses local PDA derivation — no longer fails closed on RPC blips",
    ],
  },
  {
    date: "May 2026",
    tag: "Feature",
    title: "Pip — Floating AI Agent Across Every Page",
    bullets: [
      "Pip now lives on every page of magpie.capital (and inside the dashboard, with full action proposals)",
      "Inline action cards for borrow, repay, partial repay, extend, top up — confirm right inside the chat",
      "State-aware suggestion chips that reflect what the user actually has on-chain right now",
      "Floating-button status badge turns amber when a loan needs attention, red when health is in danger",
      "24h Bearer-token session after one wallet signature — sign once, chat freely",
      "Slow-network reassurance, typewriter streaming, ↑-key recall, copy-to-clipboard, a11y dialog role + aria-live",
    ],
  },
  {
    date: "May 2026",
    tag: "Feature",
    title: "Dashboard — Full Account Hub",
    bullets: [
      "Site Wallets view with active-wallet switcher",
      "Support tickets viewer + ask-Pip thread",
      "Notification + auto-protect preferences panel (top-up assist, health-watch alerts, pump alerts)",
      "Activity feed (loans, repays, top-ups, extends, transfers, credit events)",
      "TG ↔ site account linking via short codes",
      "Live protocol ticker — TVL, active loans, today's volume, $MAGPIE price",
    ],
  },
  {
    date: "May 2026",
    tag: "Security",
    title: "Lock-Switch & Wallet-Mismatch Guards",
    bullets: [
      "/lock 24h immediately rejects every signed site action (withdraw, set-active, ticket delete, etc.) with 423 LOCKED",
      "Telegram is a separate auth surface from Phantom — a stolen seed cannot suppress the lock",
      "Wrong-wallet borrower pre-flight on every loan action — refuses if the loan PDA doesn't match the active wallet",
      "Decimals-drift refusal guard — borrow refuses if DB and on-chain decimals disagree",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Public REST API (v1)",
    bullets: [
      "GET /api/v1/stats — Protocol-level statistics",
      "GET /api/v1/tokens — All 64 tokens with live DexScreener pricing",
      "GET /api/v1/health — Protocol health overview",
      "GET /api/v1/calculate — Loan calculator with real-time pricing",
      "60-second caching, structured JSON responses, versioned endpoints",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Whitepaper & Security Page",
    bullets: [
      "Magpie Protocol Litepaper v1.0 at /whitepaper",
      "Full security audit report and transparency page at /security",
      "Bug bounty program and responsible disclosure policy",
      "10/10 security checklist with architecture diagrams",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Security",
    title: "60-Second Quote Expiry & Slippage Guard",
    bullets: [
      "Loan quotes now expire after 60 seconds to protect against price fluctuations",
      "2% maximum slippage tolerance between quote and execution",
      "Price re-verified at confirmation time — freshest price always used",
      "Stale sessions auto-cleaned from memory",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Magpie Points System",
    bullets: [
      "Earn points on every successful loan repayment",
      "Base formula: Loan SOL \u00d7 100, multiplied by tier, timing, and streak bonuses",
      "Express tier earns 1.5\u00d7, Quick 1.25\u00d7, Standard 1.0\u00d7",
      "Early repayment +25%, on-time +10%, streak bonuses up to +50%",
      "Interactive points calculator and leaderboard at /points",
      "Points accumulate with every loan — every repayment counts",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Security",
    title: "Security Hardening",
    bullets: [
      "Input sanitization on all API endpoints",
      "SSL enforcement on database connections",
      "Added .dockerignore to prevent secret leakage in builds",
      "Removed hardcoded program IDs from public configs",
      "Revoked and rotated all deployment tokens",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Open Source Release",
    bullets: [
      "Both repositories now public on GitHub (magpiecapital)",
      "Site: magpiecapital/magpie-site",
      "Bot: magpiecapital/magpie-bot",
      "Full audit confirms zero secrets in code or git history",
      "Ready for hackathon competition entry",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Credit System",
    bullets: [
      "Introducing Magpie Credit Score (300\u2013850)",
      "Four tiers: Bronze, Silver, Gold, Platinum",
      "Score based on repayment history, volume, age, diversity, liquidations",
      "Higher scores unlock better LTV, lower fees, extended terms",
      "Interactive score simulator on /credit",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Loan Calculator",
    bullets: [
      "Interactive calculator at /calculate",
      "Real-time DexScreener pricing for all 64 tokens",
      "Side-by-side tier comparison (Express, Quick, Standard)",
      "Shows SOL payout, fees, liquidation price, and health",
      "LTV education section included",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Technical Documentation",
    bullets: [
      "Comprehensive docs at /docs",
      "Architecture, loan lifecycle, security model",
      "Pricing & oracles, fee structure, wallet model",
      "Credit system documentation",
      "Stripe-inspired clean layout with sidebar navigation",
    ],
  },
  {
    date: "April 17, 2026",
    tag: "Feature",
    title: "Protocol Stats Dashboard",
    bullets: [
      "Live protocol metrics at /stats",
      "Loan volume, TVL, active loans, health distribution",
      "Top collateral tokens ranking",
      "Recent activity feed",
      "Tier distribution visualization",
    ],
  },
  {
    date: "April 16, 2026",
    tag: "Feature",
    title: "Submit Token Flow",
    bullets: [
      '\u201CSubmit Token\u201D button added to nav and tokens page hero',
      "Token request form sends to admin via Telegram",
      "Input validation and Markdown injection protection",
    ],
  },
  {
    date: "April 16, 2026",
    tag: "Improvement",
    title: "Token Page Enhancements",
    bullets: [
      "Added 61 new tokens (3 \u2192 64 total)",
      "Live DexScreener data: price, 24h change, volume, market cap",
      "Sortable columns, search by name/ticker/address",
      "Token image fallback chain (DexScreener \u2192 letter circle)",
      "Stats cards: token count, combined mcap, combined volume",
    ],
  },
  {
    date: "April 16, 2026",
    tag: "Improvement",
    title: "Homepage Overhaul",
    bullets: [
      'Prominent "Approved Tokens" callout section',
      "Expanded FAQ (6 \u2192 8 items) with LTV explainers",
      "Added token page links throughout (hero, tiers, nav, footer)",
      "Removed Discord link (no Discord exists)",
    ],
  },
  {
    date: "April 16, 2026",
    tag: "Feature",
    title: "Approved Tokens Page",
    bullets: [
      "CoinMarketCap-style token listing at /tokens",
      "Real-time pricing from DexScreener API",
      "Market cap, volume, 1h/24h performance",
      "Token request form for community submissions",
    ],
  },
  {
    date: "April 16, 2026",
    tag: "Improvement",
    title: "Brand Migration",
    bullets: [
      "Rebranded from BagBank to Magpie across all surfaces",
      "Updated Telegram bot messages, commands, and responses",
      "Updated social links and branding",
      "Updated all meta tags and OG data",
    ],
  },
  {
    date: "April 15, 2026",
    tag: "Feature",
    title: "Infrastructure Migration",
    bullets: [
      "Migrated repos to magpiecapital GitHub organization",
      "Vercel connected to magpiecapital/magpie-site",
      "Railway connected to magpiecapital/magpie-bot",
      "Docker workflow updated for new org",
    ],
  },
  {
    date: "April 2026",
    tag: "Launch",
    title: "Magpie Protocol Launch",
    bullets: [
      "Telegram bot live: @magpie_capital_bot",
      "Anchor program deployed on Solana mainnet",
      "3 lending tiers: Express (30% LTV), Quick (25%), Standard (20%)",
      "Non-custodial wallet model with AES-256 encryption",
      "Deposit watcher, health alerts, auto-liquidation",
      "Site live at magpie.capital",
    ],
  },
];

const TAG_STYLES: Record<Tag, { bg: string; text: string; dot: string; glow?: string }> = {
  Feature: {
    bg: "bg-[var(--accent-dim)]",
    text: "text-[var(--accent-deep)]",
    dot: "bg-[var(--accent)]",
  },
  Improvement: {
    bg: "bg-[var(--surface)]",
    text: "text-[var(--ink-soft)]",
    dot: "bg-[var(--ink-soft)]",
  },
  Security: {
    bg: "bg-[#f5f0ff]",
    text: "text-[#6e56a0]",
    dot: "bg-[#9b82c8]",
  },
  Launch: {
    bg: "bg-[var(--accent)]",
    text: "text-[var(--accent-ink)]",
    dot: "bg-[var(--accent)]",
    glow: "shadow-[0_0_16px_rgba(247,201,72,0.5)]",
  },
  Migration: {
    bg: "bg-[#fef3c7]",
    text: "text-[#92400e]",
    dot: "bg-[#d97706]",
  },
  Privacy: {
    bg: "bg-[#dbeafe]",
    text: "text-[#1e40af]",
    dot: "bg-[#3b82f6]",
  },
  Governance: {
    bg: "bg-[#ecfeff]",
    text: "text-[#0e7490]",
    dot: "bg-[#06b6d4]",
  },
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pt-24 pb-16 md:pt-32 md:pb-20">
        <Reveal>
          <div className="chip mb-5">Ship log</div>
          <h1 className="font-display text-6xl font-medium tracking-[-0.04em] md:text-8xl">
            Changelog
          </h1>
          <p className="mt-5 text-xl text-[var(--ink-soft)] leading-relaxed md:text-2xl">
            What we shipped, when we shipped it.
          </p>
        </Reveal>
      </section>

      {/* Timeline */}
      <section className="mx-auto max-w-3xl px-6 pb-28 md:pb-40">
        <div className="relative border-l-2 border-[var(--hairline-strong)] pl-8 md:pl-12">
          {ENTRIES.map((entry, i) => {
            const style = TAG_STYLES[entry.tag];
            const isLaunch = entry.tag === "Launch";

            return (
              <Reveal key={`${entry.title}-${i}`} delay={i * 40}>
                <div className={`relative pb-12 ${i === ENTRIES.length - 1 ? "pb-0" : ""}`}>
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-[calc(2rem+5px)] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--bg)] md:-left-[calc(3rem+5px)] ${style.dot} ${style.glow ?? ""}`}
                  />

                  {/* Date + Tag */}
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <time className="text-sm font-medium text-[var(--ink-faint)] tabular">
                      {entry.date}
                    </time>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${style.bg} ${style.text} ${isLaunch ? style.glow ?? "" : ""}`}
                    >
                      {entry.tag}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    className={`font-display text-2xl font-medium tracking-[-0.02em] md:text-3xl ${
                      isLaunch ? "text-[var(--accent-deep)]" : ""
                    }`}
                  >
                    {entry.title}
                  </h3>

                  {/* Bullets */}
                  <ul className="mt-4 space-y-2">
                    {entry.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2.5 text-[15px] leading-relaxed text-[var(--ink-soft)]"
                      >
                        <span
                          aria-hidden
                          className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-[var(--ink-faint)]"
                        />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
