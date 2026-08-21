import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { WalletLookupWidget } from "@/components/WalletLookupWidget";
import { MintAddressCopy } from "@/components/MintAddressCopy";
import { AgentDemoTerminal } from "@/components/AgentDemoTerminal";

// The $MAGPIE token mint. 44 chars, copied VERBATIM — one wrong character
// routes a buyer to the wrong token. Single source of truth for this page.
const MAGPIE_MINT = "9UuLsJ3jf8ViBNeRcwXD53re5G3ypgfKK3s2EiMMpump";
const PUMP_URL = `https://pump.fun/coin/${MAGPIE_MINT}`;
const SOLSCAN_URL = `https://solscan.io/token/${MAGPIE_MINT}`;

export const metadata: Metadata = {
  title: "magpie-x402 · Permissionless agent lending on Solana | Magpie",
  description:
    "Agents borrow SOL against their OWN assets — memecoins (V1) or tokenized RWAs (V3) — arm in-vault exits (V4), repay. No signup, no API key, zero custody. 70% of protocol fees flow to $MAGPIE holders (MGP-001).",
  openGraph: {
    title: "magpie-x402 · Permissionless agent lending on Solana",
    description:
      "Your agent borrows SOL against its own collateral across three live lending pools, arms its own in-vault exits, repays. No API keys, no accounts, zero custody. A governance-set 70% target of protocol fees (MGP-001) is allocated to $MAGPIE holders.",
  },
};

const ENDPOINTS = [
  { method: "POST", path: "/agent/intent",         desc: "CONDITIONAL borrow — \"limit order for borrows\". Bot watches your trigger, builds the tx when matched.", price: "0.01 SOL" },
  { method: "POST", path: "/agent/build-borrow",   desc: "Build an unsigned borrow tx. Agent signs + submits. All anti-exploit gates apply.",   price: "0.005 SOL" },
  { method: "POST", path: "/agent/build-deposit",  desc: "LP-side. Build an unsigned deposit tx — wraps SOL → wSOL → deposits into the LendingPool.", price: "0.002 SOL" },
  { method: "POST", path: "/agent/build-withdraw", desc: "LP-side. Build an unsigned withdraw tx. Server refuses unsafe chunk sizes.",          price: "0.002 SOL" },
  { method: "POST", path: "/agent/build-liquidate", desc: "Liquidate a past-due loan. Server pre-validates loan status + due time. Keeper receives bounty share of seized collateral.", price: "0.003 SOL" },
  { method: "POST", path: "/agent/build-repay",    desc: "Build an unsigned repay tx for an existing loan.",                                    price: "0.002 SOL" },
  { method: "GET",  path: "/agent/credit-attest",  desc: "Ed25519-signed credit attestation. Verify off-chain. The portable reputation wedge.", price: "0.0005 SOL" },
  { method: "GET",  path: "/credit-score",         desc: "On-chain credit score (300–850) + factor breakdown.",                                  price: "0.001 SOL" },
  { method: "GET",  path: "/wallet/:wallet/loans", desc: "Every loan ever opened by a wallet — active, repaid, liquidated.",                     price: "free" },
  { method: "GET",  path: "/loan/:id",             desc: "Lifecycle of a specific loan: terms, collateral, status, health, due time.",          price: "free" },
  { method: "GET",  path: "/agent/lp-state",       desc: "Depositor position + pool context — shares, deposited, current value, yield.",        price: "free" },
  { method: "GET",  path: "/agent/protocol-pulse", desc: "24h aggregates — active loans, active borrowers, borrow volume, liquidations.",       price: "free" },
  { method: "GET",  path: "/agent/activity",       desc: "Anonymized recent borrow/repay/liquidate events. Live protocol pulse.",               price: "free" },
  { method: "GET",  path: "/agent/leaderboard",    desc: "Top wallets ranked by Magpie credit score, anonymized.",                              price: "free" },
  { method: "GET",  path: "/pool",                 desc: "Live LendingPool state — TVL, utilization, total borrowed.",                          price: "free" },
  { method: "GET",  path: "/simulate-borrow",      desc: "Quote a borrow without paying. Pure math from public tier constants.",                price: "free" },
  { method: "GET",  path: "/collateral/eligible",  desc: "Catalog of every approved collateral token.",                                          price: "free" },
  { method: "GET",  path: "/markets/liquidatable", desc: "Past-due active loans — canonical liquidation-bot feed.",                              price: "free" },
  { method: "GET",  path: "/tiers",                desc: "The three tier constants — LTV / term / fee. Fixed at the program level.",            price: "free" },
];

const WHY_AGENT_NATIVE = [
  {
    title: "Pay per call. No API keys, no signup, no oauth.",
    desc: "Every paid endpoint runs the x402 (HTTP 402) standard. Your agent signs a SOL transfer to our recipient, retries with the signature in the header, gets the response. No identity, no rate-limit dashboards, no human-in-the-loop.",
  },
  {
    title: "Your agent's wallet is the borrower.",
    desc: "Magpie's lender authority co-signs server-side, but the borrower account on every loan is your agent's wallet. We never custody anything. The principal SOL lands directly in the agent's wallet; repayment comes from the agent's wallet. Burn the keypair, the loan still exists on-chain.",
  },
  {
    title: "Build credit by doing work.",
    desc: "Every loan your agent repays on time pushes its Magpie credit score (300–850) higher. The score lives on-chain in our credit oracle and is consumable by ANY other protocol via signed attestations. First time autonomous agents have had a way to earn portable reputation.",
  },
  {
    title: "Same protections humans get.",
    desc: "Agents pass every gate humans do — ban registry, TWAP impact, liquidity floors, exposure caps, cross-source pricing, cooldowns, exploit detection. No exemptions.",
  },
];

// Revalidate the live-stats strip every 60s — the underlying endpoint
// already caches at 30s, so this is a defensive ceiling on origin hits.
export const revalidate = 60;

interface ProtocolPulse {
  active_loans: number;
  active_borrowers: number;
  borrows_1h: number;
  borrows_24h: number;
  borrowed_24h_sol: number;
  repays_24h: number;
  liquidations_24h: number;
}

interface X402Metrics {
  calls_1h: number;
  calls_24h: number;
  calls_7d: number;
  revenue_24h_sol: number;
  revenue_7d_sol: number;
  unique_payers_24h: number;
  top_endpoints: Array<{ path: string; calls: number; revenue_sol: number }>;
  // x402-originated borrows — present once the bot ships PR #483; gated below so
  // this strip is a no-op until the field exists + is > 0.
  x402_borrows_24h?: number;
  x402_borrows_total?: number;
  last_x402_borrow_at?: string | null;
  last_x402_borrow_tx?: string | null;
}

interface ActivityEvent {
  type: "borrow" | "repaid" | "liquidated";
  at: string;
  borrower_short: string | null;
  amount_sol: number;
  collateral_symbol: string | null;
  ltv_pct?: number | null;
  duration_days?: number | null;
}

interface PoolLane {
  program_version: string;
  sol?: { totalDeposits?: number; totalBorrowed?: number };
  counts?: { loansIssuedLifetime?: number };
}

interface PoolsResponse {
  versions: string[];
  pools: Record<string, PoolLane>;
}

const X402_BASE = "https://x402.magpie.capital";

async function fetchProtocolPulse(): Promise<ProtocolPulse | null> {
  const BOT_API = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
  try {
    const res = await fetch(`${BOT_API}/api/v1/public/protocol-pulse`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as ProtocolPulse;
  } catch {
    return null;
  }
}

async function fetchActivity(): Promise<ActivityEvent[]> {
  const BOT_API = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
  try {
    const res = await fetch(`${BOT_API}/api/v1/public/activity?limit=12`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { events?: ActivityEvent[] };
    return data.events ?? [];
  } catch {
    return [];
  }
}

async function fetchX402Metrics(): Promise<X402Metrics | null> {
  const BOT_API = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
  try {
    const res = await fetch(`${BOT_API}/api/v1/public/x402-metrics`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as X402Metrics;
  } catch {
    return null;
  }
}

// Live three-lane pool state (V1 memecoin · V3 RWA · V4 in-vault exits) — real
// on-chain proof that every lane is funded and lending, straight from the x402 service.
async function fetchPools(): Promise<PoolsResponse | null> {
  try {
    const res = await fetch(`${X402_BASE}/api/v1/pools`, { next: { revalidate: 120 } });
    if (!res.ok) return null;
    return (await res.json()) as PoolsResponse;
  } catch {
    return null;
  }
}

// Always-on liveness signal for the status pill — pings the x402 service /health.
// Cached 60s; reflects last-known status so the page can show "live" / "reconnecting"
// instead of silently collapsing to a claims-only page when the API blips.
async function fetchX402Health(): Promise<boolean> {
  try {
    const res = await fetch(`${X402_BASE}/health`, { next: { revalidate: 60 } });
    if (!res.ok) return false;
    const j = (await res.json()) as { ok?: boolean };
    return j.ok === true;
  } catch {
    return false;
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default async function X402Page() {
  const [pulse, activity, pools, apiLive] = await Promise.all([
    fetchProtocolPulse(),
    fetchActivity(),
    fetchPools(),
    fetchX402Health(),
  ]);
  const x402metrics = await fetchX402Metrics();
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-12 text-center md:pt-32 md:pb-16">
          <Reveal>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-4">
              <div className="text-[var(--accent)] text-sm tracking-widest uppercase font-mono">
                now live on npm · npm install @magpieloans/magpie-agent
              </div>
              {/* Always-present liveness pill — never collapses to claims-only */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider ${
                  apiLive
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-600"
                }`}
              >
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    apiLive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                  }`}
                />
                {apiLive ? "x402 API · live" : "x402 API · reconnecting"}
              </span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display mx-auto max-w-5xl text-4xl sm:text-5xl font-medium tracking-[-0.04em] md:text-7xl lg:text-8xl leading-[0.95]">
              An autonomous agent takes a permissionless loan against its own assets<span className="italic">.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-[var(--ink-soft)]">
              <strong className="text-[var(--ink)]">x402 lets AI agents pay for things on their own</strong> — no human, no signup, no card. Magpie uses it so an agent can borrow crypto by itself: your agent borrows SOL against its own memecoin or tokenized-RWA collateral on Solana, arms self-owned <strong className="text-[var(--ink)]">in-vault take-profit / stop-loss exits</strong>, and repays — all on-chain. No signup. No API key. Zero custody: the borrower account is the agent&apos;s own wallet, and the only path out is a borrower-signed repay. Same anti-exploit gauntlet humans get.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/x402/link"
                className="px-6 py-3 rounded-full bg-[var(--accent)] text-[var(--ink)] hover:bg-[var(--accent-hover)] transition text-sm font-semibold"
              >
                🔗 Link your wallet — let your agent borrow →
              </Link>
              <Link
                href="/x402/setup"
                className="px-6 py-3 rounded-full bg-[var(--ink)] text-[var(--bg)] hover:opacity-90 transition text-sm font-medium"
              >
                ⚡ Set up &amp; test in minutes
              </Link>
              <Link
                href="https://www.npmjs.com/package/@magpieloans/magpie-agent"
                target="_blank"
                rel="noopener"
                className="px-6 py-3 rounded-full border border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--bg)] transition text-sm font-medium"
              >
                📦 npm · magpie-agent
              </Link>
              <Link
                href="https://www.npmjs.com/package/@magpieloans/magpie-mcp"
                target="_blank"
                rel="noopener"
                className="px-6 py-3 rounded-full border border-[var(--ink)]/40 hover:border-[var(--ink)] transition text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                🧩 MCP for Claude / Cursor / Windsurf
              </Link>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <p className="mx-auto mt-6 max-w-2xl text-sm text-[var(--ink-soft)]">
              <strong className="text-[var(--ink)]">Hold tokens and want an agent to borrow for you?</strong>{" "}
              <Link href="/x402/link" className="underline hover:text-[var(--ink)]">The 5-step Link wizard</Link>{" "}
              is your start here.{" "}
              <strong className="text-[var(--ink)]">Building an AI agent?</strong>{" "}
              <Link href="/x402/setup" className="underline hover:text-[var(--ink)]">The setup guide</Link>{" "}
              is your reference. Just want to borrow by hand?{" "}
              <Link href="/marketplace" className="underline hover:text-[var(--ink)]">Use the Borrow dashboard →</Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* In plain English — human-friendly orientation */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <Reveal>
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--ink)]/[0.02] p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-[var(--accent-deep)] mb-3 font-mono">
              In plain English
            </div>
            <p className="text-[var(--ink-soft)] leading-relaxed">
              Normally a person clicks &ldquo;borrow,&rdquo; signs, and waits.{" "}
              <strong className="text-[var(--ink)]">x402 lets an AI agent do that whole loop by itself</strong> — it pays a few cents per request (in crypto, no card or login), borrows SOL against tokens it already holds, sets its own take-profit / stop-loss, and repays. Magpie never holds the agent&apos;s wallet or keys.
            </p>
            <p className="mt-3 text-[var(--ink-soft)] leading-relaxed">
              <strong className="text-[var(--ink)]">Who&apos;s it for?</strong> Anyone who holds tokens and wants an autonomous agent to borrow against them — and developers building those agents. The easiest way in is the{" "}
              <Link href="/x402/link" className="underline hover:text-[var(--ink)]">5-step Link wizard</Link>: connect your wallet, see what you can borrow against, designate a &ldquo;brain&rdquo; wallet, and copy one config. Prefer to wire it in code?{" "}
              <Link href="/x402/setup" className="underline hover:text-[var(--ink)]">The setup guide</Link>{" "}has the SDK + MCP path. Just want to borrow by hand?{" "}
              <Link href="/marketplace" className="underline hover:text-[var(--ink)]">The Borrow dashboard</Link>.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Live protocol pulse — proof of life */}
      {pulse && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <Reveal>
            <div className="rounded-2xl border border-[var(--ink)]/15 bg-[var(--ink)]/[0.02] p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                <span className="text-xs uppercase tracking-widest text-[var(--ink-soft)]">
                  Live protocol pulse · last 24h · whole protocol (humans + agents)
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="font-display text-3xl md:text-4xl tracking-tight">
                    {pulse.borrows_24h.toLocaleString()}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                    borrows · 24h
                  </div>
                </div>
                <div>
                  <div className="font-display text-3xl md:text-4xl tracking-tight">
                    {pulse.borrowed_24h_sol.toFixed(1)}{" "}
                    <span className="text-base text-[var(--ink-soft)]">SOL</span>
                  </div>
                  <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                    volume · 24h
                  </div>
                </div>
                <div>
                  <div className="font-display text-3xl md:text-4xl tracking-tight">
                    {pulse.active_loans.toLocaleString()}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                    active loans
                  </div>
                </div>
                <div>
                  <div className="font-display text-3xl md:text-4xl tracking-tight">
                    {pulse.active_borrowers.toLocaleString()}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                    active borrowers
                  </div>
                </div>
              </div>
              <p className="text-xs text-[var(--ink-soft)] mt-6">
                Pulled live from{" "}
                <code className="font-mono">https://x402.magpie.capital/api/v1/agent/protocol-pulse</code>{" "}
                — the same free endpoint your agent can hit on every tick. These are
                whole-protocol totals (website, Telegram, and x402 agents combined).
              </p>
            </div>
          </Reveal>
        </section>
      )}

      {/* Watch an agent borrow — the demo that says everything */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-2">
            Watch an agent borrow.
          </h2>
          <p className="text-[var(--ink-soft)] mb-6 max-w-2xl">
            The whole loop — quote, 402, pay, borrow, build credit — in one
            session. Simulated replay; every path, price and response field is
            the exact production shape.
          </p>
          <AgentDemoTerminal />
        </Reveal>
      </section>

      {/* MCP — mount Magpie inside any LLM */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <div className="rounded-2xl border border-[var(--ink)]/15 bg-[var(--ink)]/[0.02] p-6 md:p-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]" />
              <span className="text-xs uppercase tracking-widest text-[var(--ink-soft)]">
                Model Context Protocol · listed in the official MCP Registry
              </span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-2">
              Mount Magpie inside your LLM.
            </h2>
            <p className="text-[var(--ink-soft)] mb-6 max-w-2xl">
              One line gives Claude (or any MCP client) native Magpie tools —
              live protocol stats, the full collateral catalog, per-token loan
              terms, and the agent borrowing guide. Read-only: it holds no keys
              and signs nothing.
            </p>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-[var(--ink)]/10 p-4">
                <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-2">Claude Code</div>
                <code className="font-mono text-[12.5px] break-all">claude mcp add magpie -- npx -y github:magpiecapital/magpie-mcp</code>
              </div>
              <div className="rounded-xl border border-[var(--ink)]/10 p-4">
                <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-2">Registry name</div>
                <code className="font-mono text-[12.5px] break-all">io.github.magpiecapital/magpie</code>
                <span className="block text-xs text-[var(--ink-soft)] mt-1">registry.modelcontextprotocol.io · status: active</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              {["magpie_protocol_stats", "magpie_list_collateral", "magpie_token_terms", "magpie_x402_guide"].map((t) => (
                <span key={t} className="rounded-full border border-[var(--ink)]/15 px-3 py-1">{t}</span>
              ))}
            </div>
            <p className="text-xs text-[var(--ink-soft)] mt-5">
              Source + MCPB bundle:{" "}
              <a className="underline hover:text-[var(--ink)]" href="https://github.com/magpiecapital/magpie-mcp" target="_blank" rel="noopener noreferrer">
                github.com/magpiecapital/magpie-mcp
              </a>{" "}
              · LLM crawler docs at{" "}
              <a className="underline hover:text-[var(--ink)]" href="/llms.txt">/llms.txt</a>
            </p>
          </div>
        </Reveal>
      </section>

      {/* x402 revenue + adoption — only shows once there's data */}
      {x402metrics && x402metrics.calls_24h > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <Reveal>
            <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                <span className="text-xs uppercase tracking-widest text-[var(--accent-deep)]">
                  Agents are paying for it · last 24h · x402-only
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div>
                  <div className="font-display text-3xl md:text-4xl tracking-tight">
                    {x402metrics.calls_24h.toLocaleString()}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                    paid calls · 24h
                  </div>
                </div>
                <div>
                  <div className="font-display text-3xl md:text-4xl tracking-tight">
                    {x402metrics.revenue_24h_sol.toFixed(3)}{" "}
                    <span className="text-base text-[var(--ink-soft)]">SOL</span>
                  </div>
                  <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                    revenue · 24h
                  </div>
                </div>
                <div>
                  <div className="font-display text-3xl md:text-4xl tracking-tight">
                    {x402metrics.unique_payers_24h.toLocaleString()}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                    unique agents
                  </div>
                </div>
                <div>
                  <div className="font-display text-3xl md:text-4xl tracking-tight">
                    {x402metrics.calls_1h.toLocaleString()}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                    calls · last hour
                  </div>
                </div>
              </div>
              {x402metrics.top_endpoints.length > 0 && (
                <div className="border-t border-[var(--ink)]/10 pt-4">
                  <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-3">
                    Top paid endpoints · 24h
                  </div>
                  <div className="space-y-1.5">
                    {x402metrics.top_endpoints.slice(0, 5).map((e) => (
                      <div
                        key={e.path}
                        className="flex items-center justify-between gap-4 text-sm font-mono"
                      >
                        <span className="truncate">{e.path}</span>
                        <span className="shrink-0 text-[var(--ink-soft)]">
                          {e.calls} call{e.calls === 1 ? "" : "s"} ·{" "}
                          <span className="text-[var(--ink)]">{e.revenue_sol.toFixed(4)} SOL</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-[var(--ink-soft)] mt-5">
                These are <strong className="text-[var(--ink)]">x402-only</strong> figures — real paid agent
                calls, settled on-chain — distinct from the whole-protocol pulse above. Live from the
                protocol&apos;s public feed{" "}
                <code className="font-mono">GET /api/v1/public/x402-metrics</code>, refreshed every 60s.
              </p>
            </div>
          </Reveal>
        </section>
      )}

      {/* x402-originated borrows — the money shot: agents actually completing loans */}
      {x402metrics && (x402metrics.x402_borrows_total ?? 0) > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <Reveal>
            <div className="rounded-2xl border border-[var(--accent)]/40 bg-gradient-to-br from-[var(--accent)]/10 via-[var(--accent)]/5 to-transparent p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                <span className="text-xs uppercase tracking-widest text-[var(--accent-deep)]">
                  Agents have borrowed through x402
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <div className="font-display text-3xl md:text-4xl tracking-tight">
                    {(x402metrics.x402_borrows_total ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                    agent loans · all-time
                  </div>
                </div>
                <div>
                  <div className="font-display text-3xl md:text-4xl tracking-tight">
                    {(x402metrics.x402_borrows_24h ?? 0).toLocaleString()}
                  </div>
                  <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mt-1">
                    agent loans · 24h
                  </div>
                </div>
                {x402metrics.last_x402_borrow_tx && (
                  <div className="flex flex-col justify-center">
                    <Link
                      href={`https://solscan.io/tx/${x402metrics.last_x402_borrow_tx}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium underline hover:text-[var(--accent-deep)]"
                    >
                      View the latest agent loan on Solscan →
                    </Link>
                    <span className="text-xs text-[var(--ink-soft)] mt-1">on-chain proof</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-[var(--ink-soft)] mt-6">
                Real loans an x402 agent opened end-to-end — paid build-borrow → signed → cosigned →
                funded on-chain. This figure is <strong className="text-[var(--ink)]">approximate</strong>:
                a loan is counted as x402-originated when the funding wallet paid for a build-borrow call
                within 30 minutes of the loan, so it never over-states. Same public feed:{" "}
                <code className="font-mono">GET /api/v1/public/x402-metrics</code>.
              </p>
            </div>
          </Reveal>
        </section>
      )}

      {/* Live activity feed — anonymized */}
      {activity.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <Reveal>
            <div className="rounded-2xl border border-[var(--ink)]/15 bg-[var(--ink)]/[0.02] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--ink)]/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                  <span className="text-xs uppercase tracking-widest text-[var(--ink-soft)]">
                    Recent activity · live
                  </span>
                </div>
                <code className="font-mono text-xs text-[var(--ink-soft)] hidden md:block">
                  GET /api/v1/agent/activity
                </code>
              </div>
              <div className="divide-y divide-[var(--ink)]/10">
                {activity.slice(0, 12).map((e, idx) => {
                  const typeColor =
                    e.type === "borrow"
                      ? "text-[var(--accent)]"
                      : e.type === "repaid"
                        ? "text-emerald-600"
                        : "text-red-500";
                  const typeLabel =
                    e.type === "borrow"
                      ? "BORROW"
                      : e.type === "repaid"
                        ? "REPAY"
                        : "LIQUIDATE";
                  return (
                    <div
                      key={`${e.at}-${idx}`}
                      className="px-6 py-3 flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`font-mono text-[10px] tracking-widest font-medium ${typeColor} w-20 shrink-0`}
                        >
                          {typeLabel}
                        </span>
                        <span className="font-mono text-xs text-[var(--ink-soft)] shrink-0">
                          {e.borrower_short ?? "—"}
                        </span>
                        <span className="truncate">
                          <span className="font-medium">
                            {e.amount_sol.toFixed(3)} SOL
                          </span>
                          {e.collateral_symbol && (
                            <span className="text-[var(--ink-soft)]">
                              {" "}
                              · {e.collateral_symbol}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--ink-soft)] font-mono shrink-0">
                        {timeAgo(e.at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* Three lending lanes — V1 / V3 / V4, with live on-chain pool proof */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-3">
            One API, three lending lanes
          </h2>
          <p className="text-[var(--ink-soft)] mb-8 max-w-3xl">
            Your agent borrows through the same SDK call no matter what it holds — Magpie routes the loan to the
            right on-chain program automatically. No-exit memecoin loans open on{" "}
            <strong className="text-[var(--ink)]">V1</strong>, no-exit tokenized-RWA loans on{" "}
            <strong className="text-[var(--ink)]">V3</strong>, and anything with armed take-profit / stop-loss
            exits on <strong className="text-[var(--ink)]">V4</strong>. All three are live and lending right now.
          </p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              v: "v1",
              tag: "V1 · memecoin",
              title: "Borrow against memecoins",
              desc: "Lock an approved memecoin, borrow SOL against it. The classic no-exit loan — borrow, hold, repay. Routed here automatically when your agent borrows a memecoin with no exits armed.",
            },
            {
              v: "v3",
              tag: "V3 · tokenized RWA",
              title: "Borrow against stocks & RWAs",
              desc: "Lock a tokenized equity or real-world asset (xStocks like TSLAx, SNDK, MU) and borrow SOL against it. Same flow, RWA-grade collateral. No-exit RWA loans route here.",
            },
            {
              v: "v4",
              tag: "V4 · in-vault exits",
              title: "Borrow + auto-sell exits",
              desc: "Borrow and arm take-profit / stop-loss that fire in-vault: proceeds accrue inside the loan's own vault, the loan stays open, and the only path to the wallet is a borrower-signed repay. The auto-sell agent's edge.",
            },
          ].map((lane) => {
            const p = pools?.pools?.[lane.v];
            const deposits = p?.sol?.totalDeposits;
            const borrowed = p?.sol?.totalBorrowed;
            const loans = p?.counts?.loansIssuedLifetime;
            return (
              <Reveal key={lane.v}>
                <div className="rounded-2xl border border-[var(--ink)]/15 p-6 h-full flex flex-col bg-[var(--ink)]/[0.02]">
                  <div className="text-xs uppercase tracking-widest text-[var(--accent-deep)] mb-2 font-mono">
                    {lane.tag}
                  </div>
                  <h3 className="font-display text-xl tracking-tight mb-3">{lane.title}</h3>
                  <p className="text-sm text-[var(--ink-soft)] leading-relaxed flex-1">{lane.desc}</p>
                  {p && (
                    <div className="mt-5 pt-4 border-t border-[var(--ink)]/10 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="font-display text-lg tracking-tight">
                          {deposits != null ? deposits.toFixed(1) : "—"}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-[var(--ink-soft)] mt-0.5">
                          SOL pool
                        </div>
                      </div>
                      <div>
                        <div className="font-display text-lg tracking-tight">
                          {borrowed != null ? borrowed.toFixed(1) : "—"}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-[var(--ink-soft)] mt-0.5">
                          borrowed
                        </div>
                      </div>
                      <div>
                        <div className="font-display text-lg tracking-tight">
                          {loans != null ? loans.toLocaleString() : "—"}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-[var(--ink-soft)] mt-0.5">
                          loans
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal>
          <p className="text-xs text-[var(--ink-soft)] mt-5">
            {pools
              ? "Per-lane numbers are live on-chain pool state from "
              : "Live per-lane pool state is served at "}
            <code className="font-mono">https://x402.magpie.capital/api/v1/pools</code>
            {" "}— deposits, borrowed, and lifetime loans for every program version.
          </p>
        </Reveal>
      </section>

      {/* Try-it-now wallet lookup */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <WalletLookupWidget />
        </Reveal>
      </section>

      {/* Quickstart: SDK + MCP side by side — both live on npm */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-3">
            Two ways to plug in <span className="text-base text-[var(--accent)] font-mono align-middle ml-3">live on npm</span>
          </h2>
          <p className="text-[var(--ink-soft)] mb-8 max-w-2xl">
            Install the TypeScript SDK and write your agent in 10 lines, or drop the MCP server into Claude Desktop / Cursor / Windsurf / ChatGPT desktop and your agent gets all 26 Magpie tools automatically (16 free reads + 10 paid actions).
          </p>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* SDK — npm install */}
          <div className="rounded-2xl border border-[var(--ink)]/15 p-6 bg-[var(--ink)]/[0.02]">
            <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-2">Option A · TypeScript SDK</div>
            <h3 className="font-display text-xl tracking-tight mb-4">Every action a one-liner</h3>
            <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)] mb-4">{`npm install @magpieloans/magpie-agent @solana/web3.js`}</pre>
            <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)]">{`import { MagpieAgent } from "@magpieloans/magpie-agent";
import { Keypair } from "@solana/web3.js";
import { readFileSync } from "fs";

// Your agent's OWN wallet — it is the borrower. Magpie never holds it.
const keypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(readFileSync("/path/to/payer.json", "utf8")))
);
const rpcUrl = "https://api.mainnet-beta.solana.com";
const agent = new MagpieAgent({ keypair, rpcUrl });

// One line borrows SOL against any approved token:
const loan = await agent.borrow({
  collateralMint,                   // from GET /collateral/eligible
  collateralAmount: 1_000_000_000n, // base units = amount × 10^decimals
  tier: "express",                  // "express" | "quick" | "standard"
});

console.log(loan.signature);
// → https://solscan.io/tx/<confirmed-on-chain-tx>`}</pre>
            <p className="text-xs text-[var(--ink-soft)] mt-3">
              Borrow · deposit · withdraw · liquidate · create conditional intent — all as one-line methods. Zero HTTP plumbing, zero transaction construction.{" "}
              <a
                href="https://www.npmjs.com/package/@magpieloans/magpie-agent"
                target="_blank"
                rel="noopener"
                className="underline"
              >
                npm
              </a>
              {" · "}
              <a
                href="https://github.com/magpiecapital/magpie-x402/blob/main/QUICKSTART.md"
                target="_blank"
                rel="noopener"
                className="underline"
              >
                10-minute quickstart
              </a>
            </p>
          </div>

          {/* MCP — npm install */}
          <div className="rounded-2xl border border-[var(--ink)]/15 p-6 bg-[var(--ink)]/[0.02]">
            <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-2">Option B · MCP server</div>
            <h3 className="font-display text-xl tracking-tight mb-4">Claude Desktop, Cursor, Windsurf, ChatGPT</h3>
            <p className="text-sm text-[var(--ink-soft)] mb-3">
              Drop into your host&apos;s MCP config (e.g.{" "}
              <code className="font-mono text-xs">claude_desktop_config.json</code>):
            </p>
            <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)]">{`{
  "mcpServers": {
    "magpie": {
      "command": "npx",
      "args": ["-y", "@magpieloans/magpie-mcp"],
      "env": {
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com",
        "MAGPIE_MCP_PAYER_KEYPAIR": "/path/to/payer.json"
      }
    }
  }
}`}</pre>
            <p className="text-xs text-[var(--ink-soft)] mt-3">
              Restart your host. The agent now has all 26 Magpie tools (16 free reads + 10 paid actions) — free reads work without any keypair; paid endpoints sign x402 payment txs locally.{" "}
              <a
                href="https://www.npmjs.com/package/@magpieloans/magpie-mcp"
                target="_blank"
                rel="noopener"
                className="underline"
              >
                npm
              </a>
              {" · "}
              <a
                href="https://github.com/magpiecapital/magpie-x402/tree/main/mcp#readme"
                target="_blank"
                rel="noopener"
                className="underline"
              >
                full configs for every host
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Full borrow lifecycle — what actually funds a loan */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-3">
            How a borrow actually completes
          </h2>
          <p className="text-[var(--ink-soft)] mb-8 max-w-3xl">
            One detail worth knowing: <strong className="text-[var(--ink)]">building the transaction is not the
            same as funding the loan.</strong> A borrow takes two signed steps — your agent signs first, then
            Magpie&apos;s lender authority co-signs and broadcasts. The SDK does all of this in one call; here it
            is unwrapped so the manual-HTTP path is just as clear.
          </p>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-6">
          <Reveal>
            <ol className="space-y-4">
              {[
                { n: "1", t: "Pay + POST /agent/build-borrow", d: "The x402 fee (0.005 SOL) is quoted, you pay, and the server returns partial_signed_tx_b64 — an UNSIGNED borrow tx. Every anti-exploit gate runs here. No loan exists yet." },
                { n: "2", t: "Your agent signs", d: "The agent signs the tx with its OWN keypair. Magpie never sees the key. The agent is the borrower on the resulting loan." },
                { n: "3", t: "POST to /api/v1/cosign-borrow", d: "Magpie's lender authority adds its co-signature — restricted to the single allowlisted request_and_fund_loan instruction — and broadcasts. The principal SOL lands in the agent's wallet. NOW the loan is funded on-chain." },
                { n: "4", t: "Verify with GET /loan/:id", d: "Confirm terms, collateral, status, health, and due time. Free endpoint — poll it any time over the life of the loan." },
              ].map((s) => (
                <li key={s.n} className="flex gap-4">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--ink)] font-display flex items-center justify-center text-sm">
                    {s.n}
                  </span>
                  <div>
                    <div className="font-mono text-sm text-[var(--ink)]">{s.t}</div>
                    <div className="text-sm text-[var(--ink-soft)] leading-relaxed mt-1">{s.d}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={80}>
            <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-6 h-full">
              <div className="text-xs uppercase tracking-widest text-[var(--accent-deep)] mb-3 font-mono">
                …or just one line
              </div>
              <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)]">{`// agent.borrow() does all four steps for you:
const loan = await agent.borrow({
  collateralMint,
  collateralAmount: 1_000_000_000n,
  tier: "express",
});

console.log(loan.signature);
// → funded on-chain; loan.loanId is live`}</pre>
              <p className="text-xs text-[var(--ink-soft)] mt-4 leading-relaxed">
                The SDK and MCP server handle the pay → build → sign → cosign → confirm loop internally, so a
                single <code className="font-mono">borrow()</code> returns a funded loan. The manual steps on the
                left are what runs under the hood — useful if you&apos;re integrating over raw HTTP.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* The Wedge: conditional borrows */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-8 md:p-10">
            <div className="text-xs uppercase tracking-widest text-[var(--accent-deep)] mb-3">First-of-its-kind</div>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-4">
              Limit orders, but for borrows.
            </h2>
            <p className="text-lg leading-relaxed text-[var(--ink)] max-w-3xl mb-6">
              An agent doesn&apos;t have to be online when the opportunity strikes. Post a <strong>conditional borrow intent</strong> — &quot;when $TOKEN trades above $0.50, borrow 5 SOL against 10000 of it&quot; — and Magpie&apos;s watcher polls live DEX prices every 30 seconds. The moment your trigger fires, the server builds the unsigned tx. Your agent polls, signs, and submits whenever it next checks in. <strong>The first permissionless lending protocol with this primitive.</strong>
            </p>
            <p className="text-lg leading-relaxed text-[var(--ink)] max-w-3xl mb-8">
              All the same anti-exploit gates run at <em>match time</em>, not creation time — fresh prices, fresh pool state, current ban list. The agent always retains final-signature authority. No custodial reservation, no smart-contract pre-commit, no funds locked.
            </p>
            <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)] max-w-3xl">{`// examples/04-conditional-borrow-intent.ts
import { paidCall, loadKeypairFromFile } from "./lib/x402-client.js";

const payer = loadKeypairFromFile(process.env.X402_PAYER_KEYPAIR!);

const create = await paidCall({ rpcUrl, payer }, "POST", "/api/v1/agent/intent", {
  body: {
    borrower_wallet:   payer.publicKey.toBase58(),
    collateral_mint:   "9UuLs...pump",
    collateral_amount: "10000000000",     // 10000 tokens (6 dp)
    tier: 0,
    condition_type: "price_above",
    condition_params: { mint: "9UuLs...pump", price_usd: "0.05", source: "jupiter" },
    expires_in_seconds: 7 * 86400,
  },
});

// Poll until matched, then sign + submit the returned partial_signed_tx_b64.
// Each poll is 0.0005 SOL — the create payment covers the watcher lifecycle.`}</pre>
          </div>
        </Reveal>
      </section>

      {/* The Wedge: signed credit attestations */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-8 md:p-10">
            <div className="text-xs uppercase tracking-widest text-[var(--accent-deep)] mb-3">The wedge</div>
            <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-4">
              Cryptographically signed on-chain credit.
            </h2>
            <p className="text-lg leading-relaxed text-[var(--ink)] max-w-3xl mb-6">
              Every paid response from <code className="font-mono">/agent/credit-attest</code> is an ed25519 signature from Magpie&apos;s lender authority over a canonical payload of your agent&apos;s score + repayment history. <strong>Other protocols can verify cryptographically — they don&apos;t have to trust this API.</strong>
            </p>
            <p className="text-lg leading-relaxed text-[var(--ink)] max-w-3xl mb-8">
              This is the first time autonomous agents have had portable on-chain credit. Your agent builds reputation by repaying on Magpie; any Solana protocol can consume that reputation as a trust signal. Network effects compound across the ecosystem.
            </p>
            <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)] max-w-3xl">{`// Any consumer can verify, no API trust required:
import nacl from "tweetnacl";
import bs58 from "bs58";

const att = await fetch("https://x402.magpie.capital/api/v1/agent/credit-attest?wallet=...")
  .then(r => r.json());

const valid = nacl.sign.detached.verify(
  Buffer.from(att.signed_payload),
  bs58.decode(att.signature),
  bs58.decode(att.attester),  // lender authority pubkey
);
// → true means the score is genuinely signed by Magpie`}</pre>
          </div>
        </Reveal>
      </section>

      {/* Endpoints */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-3">
            Endpoints
          </h2>
          <p className="text-[var(--ink-soft)] mb-8 max-w-2xl">
            All paths are relative to{" "}
            <code className="font-mono text-sm text-[var(--ink)]">https://x402.magpie.capital/api/v1</code>. Read
            endpoints are free; paid endpoints return an x402{" "}
            <code className="font-mono text-sm text-[var(--ink)]">402</code> challenge first (the price is quoted before
            you pay).
          </p>
        </Reveal>
        <div className="rounded-2xl border border-[var(--ink)]/15 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-[var(--ink)]/[0.03] text-xs uppercase tracking-widest text-[var(--ink-soft)]">
            <div className="col-span-2">Method</div>
            <div className="col-span-4">Path</div>
            <div className="col-span-4 hidden md:block">Description</div>
            <div className="col-span-2 text-right">Price</div>
          </div>
          {ENDPOINTS.map((e) => (
            <div
              key={e.path}
              className="grid grid-cols-12 gap-4 px-6 py-5 border-t border-[var(--ink)]/10 items-start"
            >
              <div className="col-span-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs border border-[var(--ink)]/20 font-mono">
                  {e.method}
                </span>
              </div>
              <div className="col-span-10 md:col-span-4 font-mono text-sm break-all">
                {e.path}
              </div>
              <div className="col-span-12 md:col-span-4 text-sm text-[var(--ink-soft)]">
                {e.desc}
              </div>
              <div className="col-span-12 md:col-span-2 text-right text-sm font-mono">
                {e.price}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why agent-native */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-8">
            Why agent-native
          </h2>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-6">
          {WHY_AGENT_NATIVE.map((w) => (
            <Reveal key={w.title}>
              <div className="rounded-2xl border border-[var(--ink)]/15 p-6 h-full">
                <h3 className="font-display text-xl tracking-tight mb-3">
                  {w.title}
                </h3>
                <p className="text-[var(--ink-soft)] leading-relaxed">{w.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* $MAGPIE token + fee-share flywheel — promotional centerpiece */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <div className="rounded-2xl border border-[var(--accent)]/40 bg-gradient-to-br from-[var(--accent)]/10 via-[var(--accent)]/5 to-transparent p-8 md:p-12">
            <div className="text-xs uppercase tracking-widest text-[var(--accent-deep)] mb-3 font-mono">
              The flywheel · $MAGPIE
            </div>
            <h2 className="font-display text-3xl md:text-5xl tracking-tight mb-5 leading-[1.02]">
              Every agent call pays. <span className="text-[var(--accent)]">70% targets $MAGPIE holders.</span>
            </h2>
            <p className="text-lg leading-relaxed text-[var(--ink)] max-w-3xl mb-8">
              Every agent borrow, exit, and conditional intent on magpie-x402 accrues protocol fees. <strong>70% of protocol fees is the governance-ratified (MGP-001) target allocation to the $MAGPIE holder-rewards pool</strong> — paid pro-rata in SOL on a governance cadence, no staking, no lockup. (Separately, SOL depositors earn a 10% LP-loyalty cut — a different pool.) More agents borrowing means more fees, which means more rewards back to the token.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="rounded-xl border border-[var(--ink)]/15 bg-[var(--ink)]/[0.03] p-5">
                <div className="font-display text-4xl tracking-tight text-[var(--accent)]">70%</div>
                <div className="text-sm text-[var(--ink-soft)] mt-1 leading-snug">
                  governance-ratified (MGP-001) target allocation of protocol fees to $MAGPIE holders
                </div>
              </div>
              <div className="rounded-xl border border-[var(--ink)]/15 bg-[var(--ink)]/[0.03] p-5">
                <div className="font-display text-4xl tracking-tight text-[var(--accent)]">SOL</div>
                <div className="text-sm text-[var(--ink-soft)] mt-1 leading-snug">
                  real on-chain payout — not emissions — pro-rata to every holder
                </div>
              </div>
              <div className="rounded-xl border border-[var(--ink)]/15 bg-[var(--ink)]/[0.03] p-5">
                <div className="font-display text-4xl tracking-tight text-[var(--accent)]">0</div>
                <div className="text-sm text-[var(--ink-soft)] mt-1 leading-snug">
                  staking, lockup, or claim friction — hold the token, receive the share
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--ink)]/15 bg-[var(--ink)]/[0.02] p-5 md:p-6 max-w-3xl">
              <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-3">
                $MAGPIE mint address · Solana
              </div>
              <MintAddressCopy address={MAGPIE_MINT} />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href={PUMP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-full bg-[var(--ink)] text-[var(--bg)] hover:opacity-90 transition text-sm font-medium"
                >
                  Buy $MAGPIE on pump.fun →
                </Link>
                <Link
                  href={SOLSCAN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-full border border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--bg)] transition text-sm font-medium"
                >
                  View on Solscan
                </Link>
                <Link
                  href="/holders"
                  className="px-5 py-2.5 rounded-full border border-[var(--ink)]/40 hover:border-[var(--ink)] transition text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  How holder rewards work
                </Link>
              </div>
              <p className="text-xs text-[var(--ink-soft)] mt-4 leading-relaxed">
                Copy the address exactly — a single wrong character is a different token. Always verify it matches{" "}
                <code className="font-mono text-[11px] break-all">{MAGPIE_MINT}</code> before buying.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Security note */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <div className="rounded-2xl border border-[var(--ink)]/15 p-6 bg-[var(--ink)]/[0.02]">
            <h3 className="font-display text-xl tracking-tight mb-3">
              Security: agents get every protection humans get
            </h3>
            <p className="text-[var(--ink-soft)] leading-relaxed mb-4">
              Magpie&apos;s lender authority co-signs every borrow server-side via a strictly-gated endpoint that allowlists exactly ONE Solana instruction (<code className="font-mono text-sm">request_and_fund_loan</code>) and rejects every other instruction the lender could sign. Agent borrows pass through the same gauntlet:
            </p>
            <ul className="grid md:grid-cols-2 gap-2 text-sm text-[var(--ink-soft)]">
              <li>• Ban registry (user + wallet + linked + funder graph)</li>
              <li>• Per-token open-loan cap (operator-tunable per mint)</li>
              <li>• Imported-wallet 24h cooldown</li>
              <li>• Rapid-fire 60s cap between borrows</li>
              <li>• Pool liquidity floor ($50k minimum)</li>
              <li>• Off-chain TWAP — spot ≤ trailing 30-min avg + 15%</li>
              <li>• Jupiter ↔ DexScreener price agreement (≤5% gap)</li>
              <li>• 1% of pool liquidity max per single loan</li>
              <li>• RWA-only enforcement on v2 pool</li>
              <li>• Exploit auto-detector + auto-ban</li>
            </ul>
            <p className="text-sm text-[var(--ink-soft)] mt-4">
              Agent gets refused at any gate? The error response tells you which one and why. Fix the input, retry. Same UX humans get on magpie.capital.
            </p>
          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
}
