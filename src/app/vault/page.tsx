import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Agent Vault Protocol — Programmable Wallets for AI Agents on Solana",
  description:
    "On-chain spending policies, session keys, daily budgets, and full audit trails. Give AI agents financial rails with the guardrails your users demand.",
  openGraph: {
    title: "Agent Vault Protocol",
    description:
      "Programmable wallets for AI agents on Solana. On-chain spending policies, session keys, and audit trails.",
  },
};

const PROGRAM_ID = "J9R83EHNJtrzwcS9PxJ9yyLs4SrWAsgQ6Laf6zNBeF8t";
const GITHUB_URL = "https://github.com/magpiecapital/magpie-bot";
const DOCS_URL = "/docs";

/* ─── Data ─── */

const SECURITY_LAYERS = [
  {
    n: "01",
    title: "Per-Transaction Limits",
    body: "Set the maximum an agent can spend in a single transaction. Enforced on-chain — no amount of SDK manipulation can bypass it.",
    code: "spend_limit: 0.1 SOL",
  },
  {
    n: "02",
    title: "Daily Budget Caps",
    body: "Rolling 24-hour spending windows prevent runaway agents. Once the cap is hit, all spend attempts revert until the window resets.",
    code: "daily_limit: 1.0 SOL",
  },
  {
    n: "03",
    title: "Session Keys",
    body: "Grant time-limited authority to an agent keypair. Sessions auto-expire. Owner can extend or revoke instantly.",
    code: "session: 7 days",
  },
  {
    n: "04",
    title: "Instant Revocation",
    body: "One transaction flips is_active to false. The agent's next spend attempt fails immediately. No grace period, no race condition.",
    code: "revoke_agent()",
  },
  {
    n: "05",
    title: "Full Audit Trail",
    body: "Every deposit, spend, policy change, and revocation emits an on-chain event. Indexers and compliance tools subscribe in real-time.",
    code: "emit!(AgentSpent { ... })",
  },
  {
    n: "06",
    title: "Rent-Safe Accounting",
    body: "The program never lets an agent drain the vault below the rent-exempt minimum. Account data is safe even at the last lamport.",
    code: "available = balance - rent",
  },
];

const USECASES = [
  {
    title: "AI Trading Agents",
    body: "Give your trading bot a vault with a $50/day budget. It executes autonomously while you sleep — if it hits the cap, it stops.",
    tag: "DeFi",
  },
  {
    title: "API Payment Rails",
    body: "Agents that consume paid APIs (LLMs, data feeds, compute) pay from their vault. x402-compatible for HTTP 402 payment flows.",
    tag: "Payments",
  },
  {
    title: "Multi-Agent Systems",
    body: "Run a fleet of specialized agents — each with its own vault, its own budget, its own session. One owner wallet controls them all.",
    tag: "Infrastructure",
  },
  {
    title: "Autonomous DAOs",
    body: "DAO-controlled vaults fund autonomous operations. The DAO sets policy via governance; agents execute within bounds.",
    tag: "Governance",
  },
];

const OWNER_CODE = `import { AgentVaultOwner } from "@magpiecapital/agent-vault-sdk";

const vault = new AgentVaultOwner(connection, ownerKeypair);

// Create a vault for an AI agent
const address = await vault.create(agentPubkey, {
  spendLimit: 0.1 * LAMPORTS_PER_SOL,   // 0.1 SOL per tx
  dailyLimit: 1.0 * LAMPORTS_PER_SOL,   // 1 SOL per day
  sessionDuration: 7 * 86400,            // 7-day session
});

// Fund the vault
await vault.deposit(address, 5 * LAMPORTS_PER_SOL);`;

const AGENT_CODE = `import { AgentVaultAgent } from "@magpiecapital/agent-vault-sdk";

const agent = new AgentVaultAgent(connection, agentKeypair);

// Spend from the vault — program enforces all limits
const sig = await agent.spend(
  vaultAddress,
  destinationPubkey,
  0.05 * LAMPORTS_PER_SOL,  // 0.05 SOL payment
);`;

const TOKEN_OWNER_CODE = `import { AgentVaultOwner } from "@magpiecapital/agent-vault-sdk";

const vault = new AgentVaultOwner(connection, ownerKeypair);

// USDC vault — $100/tx limit, $500/day
const address = await vault.createTokenVault(agentPubkey, USDC_MINT, {
  spendLimit: 100_000_000,  // 100 USDC (6 decimals)
  dailyLimit: 500_000_000,  // 500 USDC
  sessionDuration: 7 * 86400,
});

// Fund the vault with USDC
await vault.depositToken(address, USDC_MINT, 500_000_000);`;

const TOKEN_AGENT_CODE = `import { AgentVaultAgent } from "@magpiecapital/agent-vault-sdk";

const agent = new AgentVaultAgent(connection, agentKeypair);

// Agent pays for API calls in USDC
const sig = await agent.spendToken(
  vaultAddress,
  apiProviderAta,
  5_000_000,  // 5 USDC
);`;

const CPI_CODE = `// Any Solana program can trigger agent spending via CPI
use agent_vault::cpi::accounts::AgentSpend;
use agent_vault::cpi::agent_spend;

pub fn execute_task_and_pay(ctx: Context<ExecuteTask>, amount: u64) -> Result<()> {
    let cpi_ctx = CpiContext::new(
        ctx.accounts.vault_program.to_account_info(),
        AgentSpend {
            vault: ctx.accounts.vault.to_account_info(),
            agent: ctx.accounts.agent.to_account_info(),
            destination: ctx.accounts.destination.to_account_info(),
        },
    );
    agent_spend(cpi_ctx, amount)?;
    Ok(())
}`;

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/vault/derive?owner=...&agent=...", desc: "Derive vault PDA address" },
  { method: "GET", path: "/api/v1/vault/info?address=...", desc: "Full vault state, balance, and policy" },
  { method: "POST", path: "/api/v1/vault/spend", desc: "Agent spends from vault (signed)" },
  { method: "POST", path: "/api/v1/vault/create", desc: "Owner creates a new vault" },
  { method: "POST", path: "/api/v1/vault/deposit", desc: "Fund an existing vault" },
  { method: "POST", path: "/api/v1/vault/revoke", desc: "Owner revokes agent access" },
];

const SOL_INSTRUCTIONS = [
  "create_vault",
  "deposit",
  "agent_spend",
  "update_policy",
  "extend_session",
  "revoke_agent",
  "set_agent",
  "owner_withdraw",
  "close_vault",
];

const TOKEN_INSTRUCTIONS = [
  "create_token_vault",
  "deposit_token",
  "agent_spend_token",
  "update_token_policy",
  "extend_token_session",
  "revoke_token_agent",
  "owner_withdraw_token",
  "close_token_vault",
];

/* ─── Page ─── */

export default function VaultPage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-32 md:pb-36">
          <div className="fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium shadow-sm">
            <span className="live-dot" />
            <span className="text-[var(--ink)]">Built for Solana</span>
          </div>

          <h1 className="fade-up fade-up-1 font-display max-w-5xl text-[clamp(2.8rem,8vw,7.5rem)] leading-[0.92] tracking-[-0.04em] font-medium">
            Agent Vault
            <br />
            <span className="italic text-[var(--ink-soft)]">Protocol</span>
          </h1>

          <p className="fade-up fade-up-2 mt-8 max-w-2xl text-xl text-[var(--ink-soft)] leading-relaxed md:text-2xl">
            Programmable multi-asset wallets for AI agents on Solana — on-chain spending policies
            for SOL and any SPL token, session keys, CPI composability, and full audit trails.
          </p>

          <div className="fade-up fade-up-3 mt-10 flex flex-wrap items-center gap-4">
            <a href={GITHUB_URL} className="btn-accent text-base">
              View on GitHub
              <span aria-hidden>→</span>
            </a>
            <Link href={DOCS_URL} className="btn-ghost text-base">
              Read the Docs
            </Link>
            <a href="#sdk" className="btn-ghost text-base">
              SDK quickstart
            </a>
          </div>

          {/* Stats bar */}
          <div className="fade-up fade-up-4 mt-16 grid max-w-5xl grid-cols-2 gap-0 divide-x divide-[var(--hairline)] md:grid-cols-4 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] shadow-sm">
            {[
              { v: "17", l: "Instructions" },
              { v: "SOL + SPL", l: "Multi-asset" },
              { v: "6-layer", l: "Security" },
              { v: "CPI", l: "Composable" },
            ].map((s) => (
              <div key={s.l} className="px-4 py-5 text-center md:px-8">
                <div className="font-display tabular text-3xl font-medium tracking-[-0.03em] md:text-5xl">{s.v}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--ink-soft)] md:text-xs">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="fade-up mt-6 flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">Program ID</span>
            <code className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] px-3 py-1.5 font-mono text-xs text-[var(--ink-soft)] select-all">
              {PROGRAM_ID}
            </code>
          </div>
        </div>
      </section>

      {/* ── Colosseum Hackathon Banner ── */}
      <section className="border-y border-[var(--hairline)] bg-[var(--accent)]">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-6 px-6 py-5">
          <span className="text-sm font-semibold text-[var(--accent-ink)] md:text-base">
            Built for the Colosseum Frontier Hackathon
          </span>
          <span className="hidden text-sm text-[var(--accent-ink)]/70 md:inline">
            $2.75M in prizes
          </span>
          <span className="hidden text-sm text-[var(--accent-ink)]/70 md:inline">
            53/53 tests passing
          </span>
        </div>
      </section>

      {/* ── Architecture ── */}
      <section id="architecture" className="border-b border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <Reveal>
            <div className="chip mb-5">Architecture</div>
            <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
              Owner. Vault. <span className="italic text-[var(--ink-soft)]">Agent.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
              A three-party model that separates <strong className="text-[var(--ink)]">control</strong> from <strong className="text-[var(--ink)]">execution</strong>. The owner defines policy. The vault enforces it. The agent operates within it.
            </p>
          </Reveal>

          {/* Architecture flow diagram */}
          <Reveal delay={100}>
            <div className="mt-16 grid grid-cols-1 gap-0 md:grid-cols-3">
              {/* Owner */}
              <div className="relative rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 md:p-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-base font-bold text-[var(--accent-ink)]">1</div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">Owner</h3>
                <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">
                  Human or multisig. Calls <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-xs">create_vault</code> with an agent pubkey, spending limits, and session duration.
                </p>
                <div className="mt-4 rounded-lg bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--accent-deep)]">
                  owner.sign(create_vault_ix)
                </div>
                {/* Arrow */}
                <div className="absolute -bottom-5 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--hairline)] bg-[var(--bg-elevated)] text-sm font-bold text-[var(--ink-soft)] md:-right-5 md:bottom-auto md:left-auto md:top-1/2 md:-translate-y-1/2 md:translate-x-0">
                  →
                </div>
              </div>

              {/* Vault PDA */}
              <div className="relative border-x-0 md:border-x border-y md:border-y-0 border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 md:p-10 md:border-t md:border-b">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-base font-bold text-[var(--accent-ink)]">2</div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">Vault PDA</h3>
                <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">
                  Program-derived account seeded by <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-xs">[&quot;vault&quot;, owner, agent]</code>. Holds SOL or any SPL token, enforces policy, tracks spend history.
                </p>
                <div className="mt-4 rounded-lg bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--accent-deep)]">
                  138 bytes on-chain
                </div>
                <div className="absolute -bottom-5 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--hairline)] bg-[var(--bg-elevated)] text-sm font-bold text-[var(--ink-soft)] md:-right-5 md:bottom-auto md:left-auto md:top-1/2 md:-translate-y-1/2 md:translate-x-0">
                  →
                </div>
              </div>

              {/* Agent */}
              <div className="rounded-b-3xl md:rounded-r-3xl md:rounded-bl-none border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 md:p-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-base font-bold text-[var(--accent-ink)]">3</div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">Agent</h3>
                <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">
                  AI agent signs <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-xs">agent_spend</code> transactions. The program enforces 6 checks before transferring lamports. Any failure = revert.
                </p>
                <div className="mt-4 rounded-lg bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--accent-deep)]">
                  agent.spend(vault, dest, amt)
                </div>
              </div>
            </div>
          </Reveal>

          {/* Instructions list */}
          <Reveal delay={200}>
            <div className="mt-16 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 md:p-10">
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">17 Program Instructions</h3>
              <div className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-[var(--accent-deep)]">SOL Vaults (9)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {SOL_INSTRUCTIONS.map((ix) => (
                  <code
                    key={ix}
                    className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5 font-mono text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)]"
                  >
                    {ix}
                  </code>
                ))}
              </div>
              <div className="mt-5 text-xs font-medium uppercase tracking-[0.12em] text-[var(--accent-deep)]">SPL Token Vaults (8)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {TOKEN_INSTRUCTIONS.map((ix) => (
                  <code
                    key={ix}
                    className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5 font-mono text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent)]"
                  >
                    {ix}
                  </code>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Multi-Asset Vaults ── */}
      <section id="multi-asset" className="mx-auto max-w-6xl px-6 py-24 md:py-36">
        <Reveal>
          <div className="chip mb-5">Multi-Asset</div>
          <h2 className="font-display max-w-4xl text-5xl font-medium tracking-[-0.03em] md:text-7xl">
            SOL or any SPL token.
            <br />
            <span className="italic text-[var(--ink-soft)]">Same enforcement.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
            Create USDC vaults, BONK vaults, or any SPL token vault. The same 6-layer policy engine enforces
            per-transaction limits, daily budgets, and session keys — regardless of the asset.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { token: "USDC", desc: "Stablecoin payments for API calls, subscriptions, and service fees", color: "bg-blue-500/15 text-blue-400" },
              { token: "BONK", desc: "Community token rewards, tipping, and meme-powered agent interactions", color: "bg-orange-500/15 text-orange-400" },
              { token: "Any SPL", desc: "Any token mint on Solana — same vault, same policies, same security", color: "bg-[var(--accent)]/15 text-[var(--accent-deep)]" },
            ].map((t) => (
              <div key={t.token} className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-7">
                <div className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${t.color}`}>{t.token}</div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">{t.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={160}>
          <pre className="mt-10 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 text-sm leading-relaxed">
            <code>{`// USDC vault — $100/tx limit, $500/day
await vault.createTokenVault(agentPubkey, USDC_MINT, {
  spendLimit: 100_000_000,  // 100 USDC (6 decimals)
  dailyLimit: 500_000_000,  // 500 USDC
  sessionDuration: 7 * 86400,
});

// Agent pays for API calls in USDC
await agent.spendToken(vaultAddress, apiProviderAta, 5_000_000);`}</code>
          </pre>
        </Reveal>
      </section>

      {/* ── Security Model ── */}
      <section id="security" className="mx-auto max-w-6xl px-6 py-24 md:py-36">
        <Reveal>
          <div className="chip mb-5">Security model</div>
          <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-7xl">
            Six layers of
            <br />
            <span className="italic text-[var(--ink-soft)]">on-chain enforcement.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
            Every spend must pass all six checks. A single failure reverts the entire transaction. No off-chain escape hatches.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--hairline)] md:grid-cols-2 lg:grid-cols-3">
          {SECURITY_LAYERS.map((layer, i) => (
            <Reveal key={layer.title} delay={i * 60}>
              <div className="flex h-full flex-col gap-3 bg-[var(--bg-elevated)] p-8 md:p-9">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--accent-ink)]">
                    {layer.n}
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">{layer.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-[var(--ink-soft)]">{layer.body}</p>
                <code className="mt-auto inline-block self-start rounded-lg bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--accent-deep)]">
                  {layer.code}
                </code>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── SDK ── */}
      <section id="sdk" className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-36">
          <Reveal>
            <div className="chip mb-5">SDK</div>
            <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-7xl">
              Five lines to
              <br />
              <span className="italic text-[var(--ink-soft)]">integrate.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
              <code className="rounded-lg bg-[var(--bg)] px-2.5 py-1 text-sm font-medium">@magpiecapital/agent-vault-sdk</code> — TypeScript SDK for both owners and agents.
            </p>
          </Reveal>

          {/* SOL Vault SDK */}
          <div className="mt-16">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-deep)]">SOL Vaults</h3>
            <div className="mt-4 grid grid-cols-1 gap-10 lg:grid-cols-2">
              <Reveal delay={80}>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">Owner Side</h3>
                  <pre className="mt-4 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-6 text-sm leading-relaxed">
                    <code>{OWNER_CODE}</code>
                  </pre>
                </div>
              </Reveal>
              <Reveal delay={160}>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">Agent Side</h3>
                  <pre className="mt-4 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-6 text-sm leading-relaxed">
                    <code>{AGENT_CODE}</code>
                  </pre>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Token Vault SDK */}
          <div className="mt-20">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-deep)]">SPL Token Vaults</h3>
            <div className="mt-4 grid grid-cols-1 gap-10 lg:grid-cols-2">
              <Reveal delay={80}>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">Owner Side — Token</h3>
                  <pre className="mt-4 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-6 text-sm leading-relaxed">
                    <code>{TOKEN_OWNER_CODE}</code>
                  </pre>
                </div>
              </Reveal>
              <Reveal delay={160}>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">Agent Side — Token</h3>
                  <pre className="mt-4 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-6 text-sm leading-relaxed">
                    <code>{TOKEN_AGENT_CODE}</code>
                  </pre>
                </div>
              </Reveal>
            </div>
          </div>

          {/* CPI Composability */}
          <div className="mt-20">
            <Reveal delay={80}>
              <div className="chip mb-5">CPI Composability</div>
              <h3 className="font-display text-3xl font-medium tracking-[-0.02em] md:text-4xl">
                Any program can call Agent Vault.
              </h3>
              <p className="mt-3 max-w-2xl text-base text-[var(--ink-soft)] leading-relaxed">
                Other Solana programs invoke vault spending via Cross-Program Invocation. Build autonomous
                task-and-pay pipelines, DAO-triggered disbursements, or any composable workflow — all enforced
                by the same on-chain policy engine.
              </p>
              <pre className="mt-6 overflow-x-auto rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-6 text-sm leading-relaxed">
                <code>{CPI_CODE}</code>
              </pre>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Use Cases ── */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-36">
        <Reveal>
          <div className="chip mb-5">Use cases</div>
          <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-7xl">
            Built for the
            <br />
            <span className="italic text-[var(--ink-soft)]">agent economy.</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {USECASES.map((u, i) => (
            <Reveal key={u.title} delay={i * 80}>
              <div className="group flex h-full flex-col rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8 transition hover:border-[var(--accent)] hover:shadow-md md:p-10">
                <div className="chip mb-4 self-start">{u.tag}</div>
                <h3 className="font-display text-2xl font-medium tracking-[-0.02em] md:text-3xl">{u.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-[var(--ink-soft)]">{u.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── REST API ── */}
      <section id="api" className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-36">
          <Reveal>
            <div className="chip mb-5">REST API</div>
            <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-7xl">
              HTTP for
              <br />
              <span className="italic text-[var(--ink-soft)]">agents.</span>
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-[var(--ink-soft)] leading-relaxed">
              AI agents interact with their vaults over HTTP. No Solana SDK required on the agent side — just REST calls.
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="mt-14 space-y-3">
              {ENDPOINTS.map((ep) => (
                <div
                  key={ep.path}
                  className="flex items-start gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--bg)] p-5 transition hover:border-[var(--hairline-strong)]"
                >
                  <span
                    className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-bold ${
                      ep.method === "POST"
                        ? "bg-[var(--accent)]/20 text-[var(--accent-deep)]"
                        : "bg-[var(--surface-strong)] text-[var(--ink-soft)]"
                    }`}
                  >
                    {ep.method}
                  </span>
                  <div>
                    <code className="text-sm font-medium text-[var(--ink)]">{ep.path}</code>
                    <p className="mt-1 text-xs text-[var(--ink-soft)]">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Built With ── */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 py-14 md:flex-row md:justify-between">
          <div className="text-xs uppercase tracking-[0.22em] text-[var(--ink-soft)]">
            Built with
          </div>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
            {["Solana", "Anchor", "TypeScript", "Rust"].map((tech) => (
              <div
                key={tech}
                className="font-display text-xl font-medium tracking-[-0.01em] text-[var(--ink-soft)] opacity-70 transition hover:opacity-100"
              >
                {tech}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-[var(--ink)] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-28 text-center md:py-40">
          <Reveal>
            <h2 className="font-display mx-auto max-w-4xl text-5xl font-medium tracking-[-0.04em] text-white md:text-8xl">
              Give agents
              <br />
              <span className="italic text-[var(--accent)]">financial rails.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/60 leading-relaxed">
              On-chain spending policies. Session keys. Audit trails. The guardrails the agent economy needs — live on Solana mainnet.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-12 flex flex-col items-center justify-center gap-4 md:flex-row">
              <a href={GITHUB_URL} className="btn-accent text-lg">
                View on GitHub
                <span aria-hidden>→</span>
              </a>
              <Link
                href={DOCS_URL}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
              >
                Documentation
              </Link>
              <a
                href={`https://explorer.solana.com/address/${PROGRAM_ID}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
              >
                Explorer
              </a>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-10 font-mono text-xs text-white/30">
              {PROGRAM_ID}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <Footer />
    </div>
  );
}
