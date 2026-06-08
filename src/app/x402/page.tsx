import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "magpie-x402 · Agent-native lending API | Magpie",
  description:
    "AI agents pay in SOL to query our on-chain lending protocol via x402. Credit scores, loan history, pool stats — no API keys, no accounts, no custody. The first paid agent API for permissionless lending on Solana.",
  openGraph: {
    title: "magpie-x402 · Agent-native lending API",
    description:
      "Pay-per-call lending intelligence. AI agents access credit and loan data directly from the protocol — pay in SOL, get real-time answers.",
  },
};

const ENDPOINTS = [
  {
    method: "GET",
    path: "/pool",
    desc: "Current pool stats — utilization, TVL, total borrowed, depositor count.",
    price: "0.001 SOL",
  },
  {
    method: "GET",
    path: "/loan/:id",
    desc: "Lifecycle of a specific loan: terms, collateral, status, health, due time.",
    price: "0.0005 SOL",
  },
  {
    method: "GET",
    path: "/wallet/:wallet/loans",
    desc: "Every loan ever opened by a wallet — active, repaid, liquidated.",
    price: "0.001 SOL",
  },
  {
    method: "GET",
    path: "/credit-score/:wallet",
    desc: "On-chain credit score (300–850) and the components driving it.",
    price: "0.001 SOL",
  },
  {
    method: "POST",
    path: "/simulate-borrow",
    desc: "Pre-flight a borrow: estimated SOL out, fee, due date, LTV impact.",
    price: "0.002 SOL",
  },
  {
    method: "GET",
    path: "/tiers",
    desc: "Live tier table — LTV / duration / fee for each loan option.",
    price: "free",
  },
];

const WHY_THIS_MATTERS = [
  {
    title: "Agent spending is the next consumer market",
    desc: "AI agents that transact on behalf of humans don't have credit cards or API key dashboards. x402 (HTTP 402 Payment Required) is the emerging standard for autonomous machine-to-machine micropayments — and Solana is the only chain making it fast enough to matter.",
  },
  {
    title: "First paid lending API on Solana",
    desc: "Every other DeFi protocol is free-to-query — which means you can't build a sustainable agent that depends on premium signals. magpie-x402 lets an agent operator monetize their credit / loan models per-call, paid by the agents asking the question.",
  },
  {
    title: "No keys. No accounts. No custody.",
    desc: "Agents sign x402 payment proofs from their own wallets. We don't issue API tokens, don't store identity, don't take custody of agent funds. Cancellable at the wallet level — burn the funding wallet, the agent is unsubscribed.",
  },
];

export default function X402Page() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-24 pb-16 text-center md:pt-32 md:pb-20">
          <Reveal>
            <div className="text-[var(--ink-soft)] text-sm tracking-widest uppercase mb-4">
              Protocol enhancement
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display mx-auto max-w-4xl text-5xl font-medium tracking-[-0.04em] md:text-7xl lg:text-8xl leading-[0.95]">
              magpie<span className="italic">·</span>x402
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-[var(--ink-soft)]">
              AI agents access our on-chain lending protocol with x402.
              Pay in SOL, query credit and loan data directly from the protocol,
              get real-time answers — no API keys, no accounts, no custody required.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link
                href="https://github.com/magpiecapital/magpie-x402"
                target="_blank"
                rel="noopener"
                className="px-6 py-3 rounded-full border border-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--bg)] transition"
              >
                GitHub →
              </Link>
              <Link
                href="https://x402.magpie.capital/openapi.json"
                target="_blank"
                rel="noopener"
                className="px-6 py-3 rounded-full bg-[var(--ink)] text-[var(--bg)] hover:opacity-90 transition"
              >
                OpenAPI spec
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Endpoint table */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-8">
            Endpoints
          </h2>
        </Reveal>
        <div className="rounded-2xl border border-[var(--ink)]/15 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-[var(--ink)]/[0.03] text-xs uppercase tracking-widest text-[var(--ink-soft)]">
            <div className="col-span-2">Method</div>
            <div className="col-span-5">Path</div>
            <div className="col-span-3 hidden md:block">Description</div>
            <div className="col-span-2 text-right">Price</div>
          </div>
          {ENDPOINTS.map((e) => (
            <div
              key={e.path}
              className="grid grid-cols-12 gap-4 px-6 py-5 border-t border-[var(--ink)]/10 items-center"
            >
              <div className="col-span-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs border border-[var(--ink)]/20 font-mono">
                  {e.method}
                </span>
              </div>
              <div className="col-span-10 md:col-span-5 font-mono text-sm">
                {e.path}
              </div>
              <div className="col-span-12 md:col-span-3 text-sm text-[var(--ink-soft)]">
                {e.desc}
              </div>
              <div className="col-span-12 md:col-span-2 text-right text-sm font-mono">
                {e.price}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why this matters */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-8">
            Why a paid agent API
          </h2>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {WHY_THIS_MATTERS.map((w) => (
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

      {/* Quickstart */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl tracking-tight mb-8">
            Quickstart
          </h2>
        </Reveal>
        <div className="rounded-2xl border border-[var(--ink)]/15 p-6 bg-[var(--ink)]/[0.02]">
          <p className="text-[var(--ink-soft)] mb-4 leading-relaxed">
            Hit any endpoint. The server returns <code className="font-mono">HTTP 402</code>{" "}
            with payment instructions. Sign a SOL transfer to the quoted recipient
            with the quoted nonce, then re-call the endpoint with the signed
            payment header. The response is returned immediately.
          </p>
          <pre className="font-mono text-xs md:text-sm overflow-x-auto rounded-lg bg-black/30 p-4 text-[var(--ink)]">
{`# 1. Discover the endpoint price
$ curl https://x402.magpie.capital/pool
HTTP/1.1 402 Payment Required
{
  "price": "0.001",
  "currency": "SOL",
  "recipient": "5hsZBr...",
  "nonce": "..."
}

# 2. Sign + pay, then re-call with the proof
$ curl -H "X-PAYMENT: <signed-tx-base64>" https://x402.magpie.capital/pool
HTTP/1.1 200 OK
{ "tvl_sol": 412.7, "utilization_pct": 31.2, ... }`}
          </pre>
        </div>
      </section>

      <Footer />
    </div>
  );
}
