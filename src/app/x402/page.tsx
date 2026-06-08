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
  { method: "POST", path: "/agent/build-borrow",   desc: "Build an unsigned borrow tx. Agent signs + submits. All anti-exploit gates apply.",       price: "0.005 SOL" },
  { method: "GET",  path: "/agent/credit-attest",  desc: "Ed25519-signed credit attestation. Verify off-chain. The portable reputation wedge.", price: "0.0005 SOL" },
  { method: "GET",  path: "/credit-score",         desc: "On-chain credit score (300–850) + factor breakdown.",                                  price: "0.001 SOL" },
  { method: "GET",  path: "/wallet/:wallet/loans", desc: "Every loan ever opened by a wallet — active, repaid, liquidated.",                     price: "free" },
  { method: "GET",  path: "/loan/:id",             desc: "Lifecycle of a specific loan: terms, collateral, status, health, due time.",          price: "free" },
  { method: "GET",  path: "/pool",                 desc: "Live LendingPool state — TVL, utilization, total borrowed.",                          price: "free" },
  { method: "GET",  path: "/simulate-borrow",      desc: "Quote a borrow without paying x402. Pure math from public tier constants.",           price: "free" },
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

export default function X402Page() {
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
              The first permissionless lending protocol designed for autonomous agents. Pay per call over x402, sign with your own wallet, build portable on-chain credit. Ten lines of code from <code className="font-mono text-base">npm install</code> to an open loan.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="https://github.com/magpiecapital/magpie-agent"
                target="_blank"
                rel="noopener"
                className="px-6 py-3 rounded-full bg-[var(--ink)] text-[var(--bg)] hover:opacity-90 transition text-sm font-medium"
              >
                📦 SDK + MCP server →
              </Link>
              <Link
                href="https://github.com/magpiecapital/magpie-x402"
                target="_blank"
                rel="noopener"
                className="px-6 py-3 rounded-full border border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--bg)] transition text-sm font-medium"
              >
                ⚙ x402 service
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

      {/* Quickstart: SDK + MCP side by side */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-3">
            Two ways to plug in
          </h2>
          <p className="text-[var(--ink-soft)] mb-8 max-w-2xl">
            Use the TypeScript SDK directly in your agent code, or drop the MCP server into Claude Desktop / Cursor / Cline and the agent picks it up automatically.
          </p>
        </Reveal>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* TS SDK */}
          <div className="rounded-2xl border border-[var(--ink)]/15 p-6 bg-[var(--ink)]/[0.02]">
            <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-2">Option A · SDK</div>
            <h3 className="font-display text-xl tracking-tight mb-4">TypeScript / JavaScript</h3>
            <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)] mb-4">{`npm install magpie-agent`}</pre>
            <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)]">{`import { Keypair } from "@solana/web3.js";
import { MagpieAgent } from "magpie-agent";

const agent = new MagpieAgent({ keypair });

const result = await agent.borrow({
  collateralMint: "9UuLs…pump",      // $MAGPIE
  collateralAmount: 1_000_000_000_000n,
  tier: "express",                    // 30% LTV / 2d / 3% fee
});

console.log(result.signature);
// → https://solscan.io/tx/<sig>`}</pre>
          </div>

          {/* MCP */}
          <div className="rounded-2xl border border-[var(--ink)]/15 p-6 bg-[var(--ink)]/[0.02]">
            <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-2">Option B · MCP server</div>
            <h3 className="font-display text-xl tracking-tight mb-4">Claude Desktop, Cursor, Cline, Continue</h3>
            <p className="text-sm text-[var(--ink-soft)] mb-3">
              Drop into <code className="font-mono text-xs">~/Library/Application Support/Claude/claude_desktop_config.json</code>:
            </p>
            <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)]">{`{
  "mcpServers": {
    "magpie": {
      "command": "npx",
      "args": ["-y", "magpie-agent", "magpie-mcp"],
      "env": {
        "AGENT_SECRET_KEY": "<base58 secret key>"
      }
    }
  }
}`}</pre>
            <p className="text-xs text-[var(--ink-soft)] mt-3">
              Restart Claude Desktop. Your agent now has 7 Magpie tools. Use a dedicated agent wallet — never your main wallet.
            </p>
          </div>
        </div>
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
