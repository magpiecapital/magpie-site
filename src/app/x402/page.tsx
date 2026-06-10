import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "magpie-x402 · Agent-native lending on Solana | Magpie",
  description:
    "AI agents borrow SOL on-chain in 10 lines. Pay per call via x402, sign with your own wallet, build portable credit. The first lending protocol designed for autonomous agents.",
  openGraph: {
    title: "magpie-x402 · Agent-native lending on Solana",
    description:
      "Your agent borrows SOL on Magpie. No API keys, no accounts, no custody. Open source SDK + MCP server + cryptographically signed credit attestations.",
  },
};

const ENDPOINTS = [
  { method: "POST", path: "/agent/intent",         desc: "CONDITIONAL borrow — \"limit order for borrows\". Bot watches your trigger, builds the tx when matched.", price: "0.01 SOL" },
  { method: "POST", path: "/agent/build-borrow",   desc: "Build an unsigned borrow tx. Agent signs + submits. All anti-exploit gates apply.",   price: "0.005 SOL" },
  { method: "POST", path: "/agent/build-deposit",  desc: "LP-side. Build an unsigned deposit tx — wraps SOL → wSOL → deposits into the LendingPool.", price: "0.002 SOL" },
  { method: "POST", path: "/agent/build-withdraw", desc: "LP-side. Build an unsigned withdraw tx. Server refuses unsafe chunk sizes.",          price: "0.002 SOL" },
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
    desc: "Every gate the human borrow flow runs — ban registry, TWAP price-impact, pool liquidity floor, per-token exposure cap, cross-source price agreement, RWA-only enforcement, imported-wallet cooldown, exploit auto-detector — runs on agent borrows too. No exemptions. The protocol treats agents and humans identically.",
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

interface ActivityEvent {
  type: "borrow" | "repaid" | "liquidated";
  at: string;
  borrower_short: string | null;
  amount_sol: number;
  collateral_symbol: string | null;
  ltv_pct?: number | null;
  duration_days?: number | null;
}

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
  const [pulse, activity] = await Promise.all([
    fetchProtocolPulse(),
    fetchActivity(),
  ]);
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-12 text-center md:pt-32 md:pb-16">
          <Reveal>
            <div className="text-[var(--ink-soft)] text-sm tracking-widest uppercase mb-4">
              Protocol enhancement
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display mx-auto max-w-5xl text-5xl font-medium tracking-[-0.04em] md:text-7xl lg:text-8xl leading-[0.95]">
              AI agents borrow SOL on Magpie<span className="italic">.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-[var(--ink-soft)]">
              The first permissionless lending protocol designed for autonomous agents. Pay per call over x402, sign with your own wallet, build portable on-chain credit. Borrow, lend, and earn — all programmatically.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="https://github.com/magpiecapital/magpie-x402/tree/main/examples"
                target="_blank"
                rel="noopener"
                className="px-6 py-3 rounded-full bg-[var(--ink)] text-[var(--bg)] hover:opacity-90 transition text-sm font-medium"
              >
                🚀 Examples → first call in 5 min
              </Link>
              <Link
                href="https://github.com/magpiecapital/magpie-x402/tree/main/mcp"
                target="_blank"
                rel="noopener"
                className="px-6 py-3 rounded-full border border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--bg)] transition text-sm font-medium"
              >
                🧩 MCP for Claude / Cursor
              </Link>
              <Link
                href="https://x402.magpie.capital/openapi.json"
                target="_blank"
                rel="noopener"
                className="px-6 py-3 rounded-full border border-[var(--ink)]/40 hover:border-[var(--ink)] transition text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                OpenAPI spec
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Live protocol pulse — proof of life */}
      {pulse && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <Reveal>
            <div className="rounded-2xl border border-[var(--ink)]/15 bg-[var(--ink)]/[0.02] p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                <span className="text-xs uppercase tracking-widest text-[var(--ink-soft)]">
                  Live protocol pulse · last 24h
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
                Pulled from{" "}
                <code className="font-mono">/api/v1/agent/protocol-pulse</code> —
                same free endpoint your agent can hit on every tick.
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

      {/* Quickstart: examples + MCP side by side */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-3">
            Two ways to plug in
          </h2>
          <p className="text-[var(--ink-soft)] mb-8 max-w-2xl">
            Clone the repo and run an example, or drop the MCP server into Claude Desktop / Cursor / Windsurf and your agent picks up 17 Magpie tools automatically.
          </p>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Examples — drop-in TS files */}
          <div className="rounded-2xl border border-[var(--ink)]/15 p-6 bg-[var(--ink)]/[0.02]">
            <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-2">Option A · Examples</div>
            <h3 className="font-display text-xl tracking-tight mb-4">Six turn-key TypeScript agents</h3>
            <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)] mb-4">{`git clone git@github.com:magpiecapital/magpie-x402.git
cd magpie-x402 && npm install

export X402_PAYER_KEYPAIR=~/.config/solana/id.json
export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"

# Free — no payment needed
npx tsx examples/02-liquidation-bot.ts
npx tsx examples/05-loan-monitor.ts <WALLET>

# Paid — needs ~0.01 SOL in the payer wallet
npx tsx examples/03-agent-borrow.ts <MINT> <AMOUNT> 0
npx tsx examples/06-yield-agent.ts deposit 100000000`}</pre>
            <p className="text-xs text-[var(--ink-soft)] mt-3">
              Each example is a single ~60-line file. The shared{" "}
              <code className="font-mono text-xs">examples/lib/x402-client.ts</code>{" "}
              (~150 lines) is meant to be copied verbatim into any agent project — no npm package on purpose.
            </p>
          </div>

          {/* MCP */}
          <div className="rounded-2xl border border-[var(--ink)]/15 p-6 bg-[var(--ink)]/[0.02]">
            <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-2">Option B · MCP server</div>
            <h3 className="font-display text-xl tracking-tight mb-4">Claude Desktop, Cursor, Windsurf, ChatGPT</h3>
            <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)] mb-3">{`git clone git@github.com:magpiecapital/magpie-x402.git
cd magpie-x402/mcp && npm install && npm run build`}</pre>
            <p className="text-sm text-[var(--ink-soft)] mb-3">
              Then drop into your host&apos;s MCP config (e.g.{" "}
              <code className="font-mono text-xs">claude_desktop_config.json</code>):
            </p>
            <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)]">{`{
  "mcpServers": {
    "magpie": {
      "command": "node",
      "args": ["/ABS/PATH/magpie-x402/mcp/dist/index.js"],
      "env": {
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com",
        "MAGPIE_MCP_PAYER_KEYPAIR": "/ABS/PATH/payer.json"
      }
    }
  }
}`}</pre>
            <p className="text-xs text-[var(--ink-soft)] mt-3">
              Restart your host. The agent now has 17 Magpie tools — free reads work without any keypair; paid endpoints sign x402 payment txs locally. Config blocks for Cursor / Windsurf / generic hosts in{" "}
              <a href="https://github.com/magpiecapital/magpie-x402/tree/main/mcp#readme" className="underline">mcp/README.md</a>.
            </p>
          </div>
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
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-8">
            Endpoints
          </h2>
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
