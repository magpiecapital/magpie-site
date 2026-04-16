"use client";

import { useState } from "react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";

const TELEGRAM_URL = "https://t.me/magpie_bot";

type Loan = {
  id: string;
  token: string;
  collateralAmount: string;
  collateralUsd: number;
  borrowed: number;
  owed: number;
  ltv: number;
  health: number; // 0-100, higher is safer
  daysLeft: number;
  tier: "Express" | "Quick" | "Standard";
};

type TokenHolding = {
  symbol: string;
  name: string;
  amount: string;
  usd: number;
  eligible: boolean;
};

const MOCK_WALLET = "5fh2...8Qz1";
const MOCK_SOL_BALANCE = 24.83;
const MOCK_SOL_USD = 24.83 * 162;

const MOCK_HOLDINGS: TokenHolding[] = [
  { symbol: "WIF", name: "dogwifhat", amount: "14,200", usd: 3120, eligible: true },
  { symbol: "BONK", name: "Bonk", amount: "82.1M", usd: 1840, eligible: true },
  { symbol: "POPCAT", name: "Popcat", amount: "3,400", usd: 980, eligible: true },
  { symbol: "MEW", name: "cat in a dogs world", amount: "210,000", usd: 420, eligible: false },
];

const MOCK_LOANS: Loan[] = [
  {
    id: "0xa1b2",
    token: "WIF",
    collateralAmount: "8,000",
    collateralUsd: 1760,
    borrowed: 3.25,
    owed: 3.3,
    ltv: 30,
    health: 78,
    daysLeft: 1.3,
    tier: "Express",
  },
  {
    id: "0xc3d4",
    token: "BONK",
    collateralAmount: "40M",
    collateralUsd: 900,
    borrowed: 1.1,
    owed: 1.12,
    ltv: 20,
    health: 92,
    daysLeft: 5.1,
    tier: "Standard",
  },
];

function healthColor(h: number): { bg: string; label: string } {
  if (h >= 75) return { bg: "var(--good)", label: "Healthy" };
  if (h >= 50) return { bg: "var(--warn)", label: "Watch" };
  return { bg: "var(--bad)", label: "At risk" };
}

export default function DashboardPage() {
  const [address, setAddress] = useState("");
  const [connected, setConnected] = useState(true); // default to mock view

  const totalBorrowed = MOCK_LOANS.reduce((s, l) => s + l.borrowed, 0);
  const totalOwed = MOCK_LOANS.reduce((s, l) => s + l.owed, 0);
  const totalCollateralUsd = MOCK_LOANS.reduce((s, l) => s + l.collateralUsd, 0);

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/">
            <Wordmark size={28} />
          </Link>
          <nav className="flex items-center gap-8">
            <Link href="/#how" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              How it works
            </Link>
            <Link href="/#tiers" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Tiers
            </Link>
            <a href={TELEGRAM_URL} className="btn-accent text-sm">Launch</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="chip mb-4">Dashboard</div>
            <h1 className="text-5xl font-semibold tracking-[-0.04em] md:text-6xl">
              Your wallet.
              <br />
              <span className="text-[var(--ink-soft)]">Your bags.</span>
            </h1>
          </div>
          <p className="max-w-sm text-sm text-[var(--ink-soft)]">
            Preview balances, active loans, and health in one place. Actions execute inside Telegram — dashboard is read-only.
          </p>
        </div>

        {/* Wallet input */}
        <div className="mt-12 rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                Wallet
              </div>
              <div className="mt-2 font-mono text-2xl font-semibold">
                {connected ? MOCK_WALLET : "—"}
              </div>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="text"
                placeholder="Paste a Solana address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-5 py-3 font-mono text-sm outline-none transition focus:border-[var(--ink)] md:w-96"
              />
              <button
                onClick={() => setConnected(true)}
                className="btn-accent text-sm"
              >
                {connected ? "Refresh" : "Load"}
              </button>
            </div>
          </div>
        </div>

        {/* Summary grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <SummaryCard
            label="SOL balance"
            value={`${MOCK_SOL_BALANCE.toFixed(2)}`}
            sub={`$${MOCK_SOL_USD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <SummaryCard
            label="Borrowed"
            value={`${totalBorrowed.toFixed(2)} SOL`}
            sub={`${MOCK_LOANS.length} active loan${MOCK_LOANS.length === 1 ? "" : "s"}`}
          />
          <SummaryCard
            label="Owed"
            value={`${totalOwed.toFixed(2)} SOL`}
            sub={`+${(((totalOwed - totalBorrowed) / totalBorrowed) * 100).toFixed(1)}% fees`}
          />
          <SummaryCard
            label="Collateral locked"
            value={`$${totalCollateralUsd.toLocaleString()}`}
            sub="Across 2 bags"
          />
        </div>

        {/* Active loans */}
        <section className="mt-14">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-3xl font-semibold tracking-[-0.03em]">Active loans</h2>
            <a href={TELEGRAM_URL} className="text-sm font-medium text-[var(--ink-soft)] underline-offset-4 hover:text-[var(--ink)] hover:underline">
              Manage in Telegram →
            </a>
          </div>

          {MOCK_LOANS.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {MOCK_LOANS.map((loan) => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          )}
        </section>

        {/* Holdings */}
        <section className="mt-14">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-3xl font-semibold tracking-[-0.03em]">Holdings</h2>
            <div className="text-sm text-[var(--ink-soft)]">Eligible tokens can be used as collateral</div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--surface)]">
            <div className="hidden grid-cols-12 gap-4 border-b border-[var(--hairline)] px-6 py-4 text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)] md:grid">
              <div className="col-span-4">Token</div>
              <div className="col-span-3">Amount</div>
              <div className="col-span-2">Value</div>
              <div className="col-span-3 text-right">Action</div>
            </div>
            {MOCK_HOLDINGS.map((h) => (
              <div
                key={h.symbol}
                className="grid grid-cols-12 items-center gap-4 border-b border-[var(--hairline)] px-6 py-5 last:border-0"
              >
                <div className="col-span-12 md:col-span-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-dim)] font-mono text-xs font-semibold">
                      {h.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <div className="font-semibold">{h.symbol}</div>
                      <div className="text-xs text-[var(--ink-soft)]">{h.name}</div>
                    </div>
                  </div>
                </div>
                <div className="col-span-6 font-mono text-sm md:col-span-3">{h.amount}</div>
                <div className="col-span-6 text-sm md:col-span-2">
                  ${h.usd.toLocaleString()}
                </div>
                <div className="col-span-12 md:col-span-3 md:text-right">
                  {h.eligible ? (
                    <a href={TELEGRAM_URL} className="btn-ghost text-xs">
                      Pledge →
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--ink-faint)]">Not eligible</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-20 rounded-3xl border border-[var(--hairline)] bg-[var(--accent-dim)] p-10 text-center md:p-14">
          <Mark size={56} className="mx-auto mb-6" />
          <h3 className="text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
            All actions happen in Telegram
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-[var(--ink-soft)]">
            Deposit, repay, top-up, and extend are signed and broadcast from the bot. Dashboard is a read-only preview.
          </p>
          <a href={TELEGRAM_URL} className="btn-accent mt-8 text-base">
            Open @magpie_bot
            <span aria-hidden>→</span>
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-[var(--hairline)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <Wordmark size={22} />
          <div className="flex items-center gap-8 text-sm text-[var(--ink-soft)]">
            <a href={TELEGRAM_URL} className="transition hover:text-[var(--ink)]">Telegram</a>
            <Link href="/" className="transition hover:text-[var(--ink)]">Home</Link>
            <a href="#" className="transition hover:text-[var(--ink)]">X</a>
            <a href="#" className="transition hover:text-[var(--ink)]">Docs</a>
          </div>
          <div className="text-xs text-[var(--ink-soft)]">© {new Date().getFullYear()} Magpie</div>
        </div>
      </footer>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--bg)] p-6">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-[-0.03em]">{value}</div>
      <div className="mt-1 text-sm text-[var(--ink-soft)]">{sub}</div>
    </div>
  );
}

function LoanCard({ loan }: { loan: Loan }) {
  const health = healthColor(loan.health);
  const progressPct = (loan.borrowed / loan.owed) * 100;

  return (
    <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-6 transition hover:border-[var(--ink)] md:p-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-xl font-semibold">{loan.token}</div>
            <span className="chip">{loan.tier}</span>
          </div>
          <div className="mt-1 font-mono text-xs text-[var(--ink-soft)]">{loan.id}</div>
        </div>
        <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: health.bg, color: "#ffffff" }}>
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {health.label}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">Collateral</div>
          <div className="mt-1 font-mono text-sm">{loan.collateralAmount} {loan.token}</div>
          <div className="text-xs text-[var(--ink-soft)]">${loan.collateralUsd.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">Borrowed</div>
          <div className="mt-1 font-mono text-sm">{loan.borrowed} SOL</div>
          <div className="text-xs text-[var(--ink-soft)]">Owed {loan.owed} SOL</div>
        </div>
      </div>

      {/* Health bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--ink-soft)]">Health</span>
          <span className="font-mono font-semibold">{loan.health}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--hairline)]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${loan.health}%`, background: health.bg }}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-sm">
        <div className="text-[var(--ink-soft)]">
          Due in <span className="font-semibold text-[var(--ink)]">{loan.daysLeft.toFixed(1)}d</span>
        </div>
        <div className="text-[var(--ink-soft)]">
          LTV <span className="font-semibold text-[var(--ink)]">{loan.ltv}%</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <ActionLink label="Repay" />
        <ActionLink label="Top-up" />
        <ActionLink label="Partial" />
        <ActionLink label="Extend" />
      </div>
    </div>
  );
}

function ActionLink({ label }: { label: string }) {
  return (
    <a
      href={TELEGRAM_URL}
      className="rounded-full border border-[var(--hairline)] bg-[var(--bg)] px-3 py-2 text-center text-xs font-semibold transition hover:border-[var(--ink)] hover:bg-[var(--surface)]"
    >
      {label}
    </a>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--hairline)] bg-[var(--surface)] p-14 text-center">
      <Mark size={48} className="mx-auto mb-5" />
      <div className="text-lg font-semibold">No active loans</div>
      <div className="mt-2 text-sm text-[var(--ink-soft)]">
        Pledge a bag in Telegram to get started.
      </div>
      <a href={TELEGRAM_URL} className="btn-accent mt-6 text-sm">
        Launch on Telegram →
      </a>
    </div>
  );
}
