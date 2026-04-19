import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Agent Vault Protocol — Magpie Capital",
  description:
    "Programmable wallets for AI agents on Solana. On-chain spending policies, session keys, daily limits, and full audit trails.",
};

const PROGRAM_ID = "J9R83EHNJtrzwcS9PxJ9yyLs4SrWAsgQ6Laf6zNBeF8t";

const FEATURES = [
  {
    title: "Per-Transaction Limits",
    description:
      "Set the maximum an agent can spend in a single transaction. The program enforces this on-chain — no amount of SDK manipulation can bypass it.",
    code: "spend_limit: 0.1 SOL",
  },
  {
    title: "Daily Budget Caps",
    description:
      "Rolling 24-hour spending windows prevent runaway agents. Once the daily cap is hit, all spend attempts revert until the window resets.",
    code: "daily_limit: 1.0 SOL",
  },
  {
    title: "Session Keys",
    description:
      "Grant time-limited authority to an agent keypair. Sessions auto-expire — no need to remember to revoke. Owner can extend or revoke instantly.",
    code: "session: 7 days",
  },
  {
    title: "Instant Revocation",
    description:
      "One transaction flips is_active to false. The agent's next spend attempt fails immediately. No grace period, no race condition.",
    code: "revoke_agent()",
  },
  {
    title: "Full Audit Trail",
    description:
      "Every deposit, spend, policy change, and revocation emits an on-chain event. Indexers, dashboards, and compliance tools can subscribe in real-time.",
    code: "emit!(AgentSpent { ... })",
  },
  {
    title: "Rent-Safe Accounting",
    description:
      "The program never lets an agent drain the vault below the rent-exempt minimum. Your account data is safe even if the agent spends to the last lamport.",
    code: "available = balance - rent",
  },
];

const USECASES = [
  {
    title: "AI Trading Agents",
    description: "Give your trading bot a vault with a $50/day budget. It executes autonomously while you sleep — if it hits the cap, it stops.",
  },
  {
    title: "API Payment Rails",
    description: "AI agents that consume paid APIs (LLMs, data feeds, compute) can pay from their vault. x402-compatible for HTTP 402 flows.",
  },
  {
    title: "Multi-Agent Systems",
    description: "Run a fleet of specialized agents — each with its own vault, its own budget, its own session. One owner wallet controls them all.",
  },
  {
    title: "Autonomous DAOs",
    description: "DAO-controlled vaults fund autonomous operations. The DAO sets policy via governance; agents execute within bounds.",
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

const CPI_CODE = `// Any Solana program can read vault state via CPI
let vault_info = ctx.accounts.vault.to_account_info();
let vault: Vault = Vault::try_from(&vault_info)?;

// Check if agent is authorized and within budget
require!(vault.is_active, VaultError::VaultInactive);
require!(vault.daily_remaining() > amount, VaultError::ExceedsDailyLimit);`;

export default function VaultPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-lg font-semibold tracking-tight">
            Magpie
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/docs" className="text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]">Docs</Link>
            <Link href="/dashboard" className="text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]">Dashboard</Link>
            <a
              href="https://github.com/magpiecapital"
              className="text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-20 md:pt-28 md:pb-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium shadow-sm">
            <span className="live-dot" />
            <span>Solana Program</span>
          </div>

          <h1 className="font-display mt-6 max-w-4xl text-[clamp(2.5rem,7vw,6rem)] leading-[0.95] tracking-[-0.04em] font-medium">
            Agent Vault
            <br />
            <span className="italic text-[var(--ink-soft)]">Protocol</span>
          </h1>

          <p className="mt-6 max-w-2xl text-xl text-[var(--ink-soft)] leading-relaxed">
            Programmable wallets for AI agents on Solana. Create vaults with
            on-chain spending policies, session keys, and daily budgets.
            Agents transact autonomously — within bounds you control.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <a href="https://github.com/magpiecapital/magpie-bot" className="btn-accent text-sm">
              View Source
            </a>
            <Link href="/docs" className="btn-ghost text-sm">
              Read the Docs
            </Link>
          </div>

          <div className="mt-12 grid max-w-3xl grid-cols-3 gap-0 divide-x divide-[var(--hairline)] rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] shadow-sm">
            {[
              { v: "9", l: "Instructions" },
              { v: "138B", l: "Account size" },
              { v: "238K", l: "Binary" },
            ].map((s) => (
              <div key={s.l} className="px-4 py-5 text-center md:px-6">
                <div className="font-display tabular text-3xl font-medium tracking-[-0.03em] md:text-4xl">{s.v}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--ink-soft)] md:text-xs">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 font-mono text-xs text-[var(--ink-faint)]">
            Program ID: {PROGRAM_ID}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="chip mb-5">Architecture</div>
          <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-5xl">
            How it works
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold">1</div>
              <h3 className="mt-4 text-lg font-semibold">Owner Creates Vault</h3>
              <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">
                Human owner calls <code className="text-xs bg-[var(--surface)] px-1 py-0.5 rounded">create_vault</code> with an agent pubkey, spending limits, and session duration. A PDA is created: <code className="text-xs bg-[var(--surface)] px-1 py-0.5 rounded">[&quot;vault&quot;, owner, agent]</code>.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold">2</div>
              <h3 className="mt-4 text-lg font-semibold">Fund the Vault</h3>
              <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">
                Anyone deposits SOL into the vault. The program tracks <code className="text-xs bg-[var(--surface)] px-1 py-0.5 rounded">total_received</code> and emits a <code className="text-xs bg-[var(--surface)] px-1 py-0.5 rounded">Deposited</code> event.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold">3</div>
              <h3 className="mt-4 text-lg font-semibold">Agent Spends</h3>
              <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">
                Agent signs a <code className="text-xs bg-[var(--surface)] px-1 py-0.5 rounded">agent_spend</code> transaction. The program enforces 6 checks before transferring lamports. If any fail, the transaction reverts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="chip mb-5">Security model</div>
        <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-5xl">
          Six layers of enforcement
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6">
              <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">{f.description}</p>
              <code className="mt-3 inline-block rounded bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--accent-deep)]">
                {f.code}
              </code>
            </div>
          ))}
        </div>
      </section>

      {/* SDK */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="chip mb-5">SDK</div>
          <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-5xl">
            5 lines to integrate
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[var(--ink-soft)]">
            <code className="rounded bg-[var(--bg)] px-2 py-0.5 text-sm">@magpiecapital/agent-vault-sdk</code> — TypeScript SDK for both owners and agents.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">Owner Side</h3>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-[var(--hairline)] bg-[var(--bg)] p-5 text-sm leading-relaxed">
                <code>{OWNER_CODE}</code>
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">Agent Side</h3>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-[var(--hairline)] bg-[var(--bg)] p-5 text-sm leading-relaxed">
                <code>{AGENT_CODE}</code>
              </pre>
              <h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--ink-faint)]">CPI Integration</h3>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-[var(--hairline)] bg-[var(--bg)] p-5 text-sm leading-relaxed">
                <code>{CPI_CODE}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="chip mb-5">Use cases</div>
        <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-5xl">
          Built for the agent economy
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {USECASES.map((u) => (
            <div key={u.title} className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6">
              <h3 className="text-lg font-semibold tracking-tight">{u.title}</h3>
              <p className="mt-2 text-sm text-[var(--ink-soft)] leading-relaxed">{u.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* API */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="chip mb-5">API</div>
          <h2 className="font-display max-w-3xl text-4xl font-medium tracking-[-0.03em] md:text-5xl">
            REST API for agents
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[var(--ink-soft)]">
            AI agents interact with their vaults over HTTP. No Solana SDK needed on the agent side.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { method: "GET", path: "/api/v1/vault/derive?owner=...&agent=...", desc: "Derive vault PDA address" },
              { method: "GET", path: "/api/v1/vault/info?address=...", desc: "Full vault state, balance, policy" },
              { method: "POST", path: "/api/v1/vault/spend", desc: "Agent spends from vault" },
            ].map((ep) => (
              <div key={ep.path} className="flex items-start gap-4 rounded-xl border border-[var(--hairline)] bg-[var(--bg)] p-4">
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${ep.method === "POST" ? "bg-blue-500/20 text-blue-400" : "bg-green-500/20 text-green-400"}`}>
                  {ep.method}
                </span>
                <div>
                  <code className="text-sm font-medium">{ep.path}</code>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">{ep.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[var(--ink)] text-white">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
          <h2 className="font-display text-4xl font-medium tracking-[-0.03em] md:text-6xl">
            Build on Agent Vault
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-white/60">
            Give your AI agents the financial rails they need — with the guardrails your users demand.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href="https://github.com/magpiecapital/magpie-bot" className="btn-accent text-base">
              View on GitHub
            </a>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-base font-semibold backdrop-blur hover:bg-white/10">
              Documentation
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
