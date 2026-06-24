import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Set up & test x402 in minutes | Magpie",
  description:
    "A simple, step-by-step guide for humans and AI agents to connect to Magpie's x402 API — install the MCP server in one line, or test any endpoint with a single curl. No signup, no API key, zero custody.",
  openGraph: {
    title: "Set up & test x402 on Magpie — in minutes",
    description:
      "Connect any MCP-aware agent (Claude, Cursor, Windsurf) in one line, or test by hand with curl. Free read endpoints need nothing; paid endpoints use the x402 (HTTP 402) standard.",
  },
};

const BASE = "https://x402.magpie.capital";

export default function X402SetupPage() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center md:pt-32 md:pb-20">
          <Reveal>
            <div className="mb-4 font-mono text-sm uppercase tracking-widest text-[var(--accent-deep)]">
              x402 · get started
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display mx-auto max-w-3xl text-4xl font-medium leading-[0.98] tracking-[-0.04em] md:text-6xl">
              Set up & test x402 in minutes
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-[var(--ink-soft)]">
              Magpie speaks the open x402 (HTTP 402) standard, so any agent — or
              any human with a terminal — can connect with no signup, no API key,
              and zero custody. Pick your path below.
            </p>
          </Reveal>
          <Reveal delay={220}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <a href="#agents" className="btn-accent">
                I&apos;m setting up an agent
              </a>
              <a href="#humans" className="btn-ghost">
                I want to test it by hand
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Before you start */}
      <section className="mx-auto max-w-3xl px-6 pt-10">
        <Callout>
          <strong>Before you start —</strong> you need almost nothing. The free
          read tools and the entire &ldquo;test it by hand&rdquo; path need only a
          terminal: no account, no API key, no signup. To make a <em>paid</em>{" "}
          call you also need a Solana wallet holding a little SOL, exported as a
          JSON keypair file (the number array that Phantom or{" "}
          <code>solana-keygen</code> produces). That keypair stays on your
          machine — Magpie never sees it.
        </Callout>
      </section>

      {/* What is x402 / how / why */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
          <Section chip="The 30-second version" title="What is x402, and why Magpie?">
            <P>
              <strong>x402</strong> is an open payment standard built on the
              long-dormant HTTP <code>402 Payment Required</code> status code. An
              endpoint answers a request with a <code>402</code> and a tiny
              machine-readable challenge — pay <em>this</em> amount to{" "}
              <em>this</em> address — the caller pays on-chain and retries with
              the payment signature in a header, and the endpoint serves the
              result. No accounts, no API keys, no OAuth, no invoices. It is
              designed for autonomous software that needs to pay for things
              without a human in the loop.
            </P>
            <H3>How it works on Magpie</H3>
            <P>
              Magpie is permissionless lending on Solana. With x402, an
              autonomous agent can take a loan against its{" "}
              <strong>own</strong> assets end-to-end: it calls a paid endpoint to
              build an unsigned borrow transaction, signs it with its own
              wallet, and the principal SOL lands directly in that wallet. The
              agent&apos;s wallet is always the borrower — Magpie&apos;s lender
              authority only co-signs server-side and <strong>never</strong>{" "}
              custodies anything. The same applies to repaying, arming in-vault
              take-profit / stop-loss exits, providing liquidity, and
              liquidating. Read endpoints (pool state, quotes, a wallet&apos;s
              loans) are free; actions that build a transaction or return a
              private signal cost a few thousandths of a SOL per call.
            </P>
            <H3>Why an agent should use Magpie</H3>
            <ul className="mt-3 space-y-2.5 text-[15px] leading-relaxed text-[var(--ink-soft)]">
              <Bullet>
                <strong>Zero custody, zero signup.</strong> The agent&apos;s
                keypair is the borrower. Burn the key and the loan still exists
                on-chain. Nothing to register, nothing to revoke.
              </Bullet>
              <Bullet>
                <strong>Pay per call, in SOL or USDC.</strong> Every paid
                endpoint settles over the x402 standard — native SOL, or USDC /
                wSOL via a facilitator. The agent pays exactly what the challenge
                quotes, nothing more.
              </Bullet>
              <Bullet>
                <strong>Portable, earned reputation.</strong> Every loan repaid
                on time raises the agent&apos;s on-chain Magpie credit score
                (300–850), consumable by any other protocol via signed
                attestations.
              </Bullet>
              <Bullet>
                <strong>Identical protections to humans.</strong> The same price,
                liquidity, exposure, and exploit-detection gates run on agent
                borrows — no exemptions, no special-casing.
              </Bullet>
            </ul>
          </Section>
        </div>
      </section>

      {/* For agents */}
      <section id="agents" className="scroll-mt-24">
        <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
          <Section chip="Path A · for agents" title="Connect any MCP agent in one line">
            <P>
              The fastest way to use Magpie is the official MCP server — a
              standard plug-in that lets AI apps (Claude Desktop, Cursor,
              Windsurf, and any MCP-aware host) use external tools. Add this to
              your MCP config and that&apos;s the entire install:
            </P>
            <CodeBlock>{`{
  "mcpServers": {
    "magpie": {
      "command": "npx",
      "args": ["-y", "@magpieloans/magpie-mcp"]
    }
  }
}`}</CodeBlock>
            <P>
              Restart your host and ask it something like{" "}
              <em>&ldquo;What are Magpie&apos;s live lending pools?&rdquo;</em> or{" "}
              <em>&ldquo;Simulate borrowing against 1,000 USDC.&rdquo;</em> The
              agent now has{" "}
              <strong>16 free read tools</strong> — pool state, quotes, loan
              lookups, the collateral catalog, liquidatable markets, the credit
              leaderboard — with <strong>no key and no payment required</strong>.
            </P>
            <Callout>
              <strong>Want the paid actions too?</strong> Tools that build a
              transaction (borrow, repay, deposit, liquidate, arm exits) or
              return a private signal (credit score, token risk) settle a small
              x402 fee. Point the server at a funded Solana keypair and they turn
              on automatically:
              <CodeBlock>{`"env": {
  "MAGPIE_MCP_PAYER_KEYPAIR": "/path/to/payer-id.json"
}`}</CodeBlock>
              The keypair stays entirely on your machine — Magpie never sees it.
            </Callout>
            <H3>Prefer code over MCP?</H3>
            <P>
              Hit the HTTP API directly, or use the TypeScript SDK
              (<code>@magpieloans/magpie-agent</code>) which handles the x402
              signing loop for you. Every endpoint is self-describing at{" "}
              <code>{BASE}/.well-known/x402.json</code> and{" "}
              <code>{BASE}/openapi.json</code>.
            </P>
          </Section>
        </div>
      </section>

      {/* For humans */}
      <section id="humans" className="scroll-mt-24 border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
          <Section chip="Path B · test it by hand" title="Test x402 with three curls">
            <H3>1 · A free endpoint (no payment, instant)</H3>
            <P>
              Confirm you can reach the service. This returns the live on-chain
              lending pool — TVL, utilization, total borrowed:
            </P>
            <CodeBlock>{`curl -s ${BASE}/api/v1/pool`}</CodeBlock>
            <P>
              Try the quote endpoint too — it prices a hypothetical loan with
              pure math, no payment:
            </P>
            <CodeBlock>{`curl -s "${BASE}/api/v1/simulate-borrow?mint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000000&decimals=6&pricePerTokenUsd=1&solPriceUsd=150&tier=all"`}</CodeBlock>

            <H3>2 · A paid endpoint — see the challenge</H3>
            <P>
              Call a paid endpoint with no payment. Instead of an error you get a{" "}
              <code>402</code> with a precise, machine-readable bill — the exact
              amount, the recipient, a one-time nonce, and the memo to include:
            </P>
            <CodeBlock>{`curl -i "${BASE}/api/v1/credit-score?wallet=<ANY_WALLET_PUBKEY>"`}</CodeBlock>
            <CodeBlock>{`HTTP/2 402
X-Payment-Required-Amount: 1000000          # lamports = 0.001 SOL
X-Payment-Required-Recipient: <magpie pubkey>
X-Payment-Required-Memo: magpie-x402:<nonce>

{ "error": "payment_required", "amountLamports": "1000000",
  "payTo": "<magpie pubkey>", "memo": "magpie-x402:<nonce>",
  "instructions": "Send 1000000 lamports to payTo with this memo,
                   then retry with header X-Payment: <tx_signature>" }`}</CodeBlock>

            <H3>3 · Pay, then retry with the proof</H3>
            <P>
              Send the exact amount of SOL to the recipient with that memo (from
              any Solana wallet, or let the SDK / MCP server do it for you), then
              retry the same URL with the transaction signature in the{" "}
              <code>X-Payment</code> header. The server verifies the payment
              on-chain — right amount, right recipient, right memo, used only
              once — and serves the result:
            </P>
            <CodeBlock>{`curl -i -H "X-Payment: <your_tx_signature>" \\
  "${BASE}/api/v1/credit-score?wallet=<ANY_WALLET_PUBKEY>"`}</CodeBlock>
            <Callout>
              <strong>That&apos;s the whole protocol.</strong> The challenge tells
              you exactly what to pay <em>before</em> you spend a lamport — there
              are no surprise charges, and a denied request never costs you. Most
              callers let the SDK or MCP server do steps 2–3 automatically.
            </Callout>
            <H3>The two payment rails</H3>
            <P>
              Every paid endpoint accepts either rail — your agent picks
              whichever it already holds (wSOL is simply SOL wrapped as a token):
            </P>
            <Table
              headers={["Rail", "Asset", "How"]}
              rows={[
                ["Native", "SOL", "Direct SOL transfer + memo. Simplest — no token accounts."],
                ["Standard x402 v2", "USDC / wSOL", "Token transfer via a facilitator (a helper service that pays the network fee for you). The challenge's PAYMENT-REQUIRED header carries the full offer."],
              ]}
            />
          </Section>
        </div>
      </section>

      {/* Pricing snapshot */}
      <section className="scroll-mt-24">
        <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
          <Section chip="What costs what" title="Free reads, pay-per-action">
            <P>
              Anything that just reads protocol state is free. Anything that
              builds a transaction or returns a private signal is a few
              thousandths of a SOL — quoted up front on every call.
            </P>
            <Table
              headers={["Endpoint", "Price"]}
              rows={[
                ["pool · pools · tiers · simulate-borrow · collateral/eligible", "free"],
                ["wallet/:wallet/loans · loan/:id · markets/liquidatable", "free"],
                ["agent/protocol-pulse · activity · leaderboard · lp-state", "free"],
                ["credit-score · token-risk", "0.001 SOL"],
                ["agent/credit-attest", "0.0005 SOL"],
                ["agent/build-repay · build-deposit · build-withdraw", "0.002 SOL"],
                ["agent/build-liquidate", "0.003 SOL"],
                ["agent/build-borrow", "0.005 SOL"],
                ["agent/intent (full conditional borrow lifecycle)", "0.01 SOL"],
              ]}
            />
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href="/x402" className="btn-ghost">
                ← Back to x402 overview
              </Link>
              <Link href="/docs" className="btn-ghost">
                Full docs
              </Link>
              <a
                href="https://www.npmjs.com/package/@magpieloans/magpie-mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                npm · magpie-mcp ↗
              </a>
              <a
                href="https://github.com/magpiecapital/magpie-x402"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                GitHub ↗
              </a>
            </div>
          </Section>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ---- local content helpers (match /docs conventions) ---- */

function Section({
  chip,
  title,
  children,
}: {
  chip: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Reveal>
        <div className="chip mb-4">{chip}</div>
        <h2 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-4xl">
          {title}
        </h2>
      </Reveal>
      <Reveal delay={80}>
        <div className="mt-6">{children}</div>
      </Reveal>
    </div>
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

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-deep)]" />
      <span>{children}</span>
    </li>
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
