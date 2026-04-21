"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PhoneMock } from "@/components/PhoneMock";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const FEE_RATE = 0.015;

/* ───────────────────────── LOAN TIERS ───────────────────────── */

const TIERS = [
  {
    name: "Express",
    ltv: 0.3,
    days: 2,
    tag: "Most SOL",
    desc: "Maximum borrowing power. Best for short-term plays where you need the most capital.",
  },
  {
    name: "Quick",
    ltv: 0.25,
    days: 3,
    tag: "Popular",
    desc: "Balanced option. More time to repay with a comfortable loan-to-value ratio.",
  },
  {
    name: "Standard",
    ltv: 0.2,
    days: 7,
    tag: "Safest",
    desc: "Lowest LTV means more room before liquidation. A full week to repay.",
  },
];

/* ───────────────────────── CREDIT TIERS ───────────────────────── */

const CREDIT_TIERS = [
  { name: "Bronze", range: "300–499", ltv: "20–30%", fee: "1.5%", term: "7 days" },
  { name: "Silver", range: "500–649", ltv: "22–32%", fee: "1.5%", term: "7 days" },
  { name: "Gold", range: "650–749", ltv: "25–35%", fee: "1.25%", term: "14 days" },
  { name: "Platinum", range: "750–850", ltv: "28–38%", fee: "1.0%", term: "30 days" },
];

/* ───────────────────────── HOW TO BORROW ───────────────────────── */

const STEPS = [
  {
    num: "1",
    title: "Open the Telegram bot",
    desc: "Start a chat with @magpie_capital_bot. Connect your Solana wallet when prompted.",
    cmd: "/start",
  },
  {
    num: "2",
    title: "Choose your collateral",
    desc: "Pick from 64+ approved memecoins. The bot shows your eligible tokens and their current value automatically.",
    cmd: "/borrow",
  },
  {
    num: "3",
    title: "Select a loan tier",
    desc: "Express (30% LTV, 2 days), Quick (25%, 3 days), or Standard (20%, 7 days). You'll see the exact SOL you'll receive before confirming.",
    cmd: null,
  },
  {
    num: "4",
    title: "Receive SOL instantly",
    desc: "Confirm the transaction in your wallet. SOL is deposited to your wallet in seconds. A 1.5% origination fee is deducted upfront.",
    cmd: null,
  },
  {
    num: "5",
    title: "Repay and get your tokens back",
    desc: "Repay the loan amount before the term ends. Your collateral is returned immediately. On-time repayment builds your credit score.",
    cmd: "/repay",
  },
];

/* ───────────────────────── MINI CALCULATOR ───────────────────────── */

function LoanCalculator() {
  const [collateralValue, setCollateralValue] = useState(1000);
  const [selectedTier, setSelectedTier] = useState(0);

  const tier = TIERS[selectedTier];
  const loanAmount = collateralValue * tier.ltv;
  const fee = loanAmount * FEE_RATE;
  const payout = loanAmount - fee;
  const liquidationPrice = (1.1 * loanAmount) / collateralValue;

  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
      <h3 className="font-display text-lg font-semibold text-[var(--ink)]">Quick estimate</h3>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Drag to see how much SOL you can borrow.</p>

      {/* Collateral slider */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--ink-soft)]">Collateral value (USD)</span>
          <span className="font-display text-xl font-semibold text-[var(--ink)]">${collateralValue.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min={100}
          max={50000}
          step={100}
          value={collateralValue}
          onChange={(e) => setCollateralValue(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between text-[10px] text-[var(--ink-faint)]">
          <span>$100</span>
          <span>$50,000</span>
        </div>
      </div>

      {/* Tier picker */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {TIERS.map((t, i) => (
          <button
            key={t.name}
            onClick={() => setSelectedTier(i)}
            className={`rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition ${
              selectedTier === i
                ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--ink)]"
                : "border-[var(--hairline)] text-[var(--ink-soft)] hover:border-[var(--accent)]"
            }`}
          >
            <div className="font-semibold">{t.name}</div>
            <div className="text-[11px] text-[var(--ink-faint)]">{Math.round(t.ltv * 100)}% &middot; {t.days}d</div>
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-[var(--surface)] p-4">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">You receive</div>
          <div className="mt-1 font-display text-2xl font-bold text-[var(--accent-deep)]">
            ${payout.toFixed(2)}
          </div>
          <div className="text-xs text-[var(--ink-faint)]">in SOL equivalent</div>
        </div>
        <div className="rounded-xl bg-[var(--surface)] p-4">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Repay</div>
          <div className="mt-1 font-display text-2xl font-bold text-[var(--ink)]">
            ${loanAmount.toFixed(2)}
          </div>
          <div className="text-xs text-[var(--ink-faint)]">within {tier.days} days</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-3 text-sm">
        <span className="text-[var(--ink-soft)]">Origination fee ({(FEE_RATE * 100).toFixed(1)}%)</span>
        <span className="font-medium text-[var(--ink)]">${fee.toFixed(2)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-3 text-sm">
        <span className="text-[var(--ink-soft)]">Liquidation threshold</span>
        <span className="font-medium text-[var(--ink)]">{(liquidationPrice * 100).toFixed(1)}% of current price</span>
      </div>

      <div className="mt-5 text-center">
        <Link
          href="/calculate"
          className="text-sm font-medium text-[var(--accent-deep)] hover:underline underline-offset-2"
        >
          Open full calculator with token selection &rarr;
        </Link>
      </div>
    </div>
  );
}

/* ───────────────────────── MAIN PAGE ───────────────────────── */

export function MarketplaceClient() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Header />

      <main className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
        {/* ── Hero ── */}
        <div className="text-center">
          <div className="inline-block rounded-full bg-[var(--accent-dim)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-deep)]">
            Instant memecoin-backed loans
          </div>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-5xl lg:text-6xl">
            Borrow SOL against<br className="hidden sm:block" /> your bags.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--ink-soft)]">
            Magpie lends you SOL instantly. Deposit your memecoins as collateral, pick a loan tier,
            and receive SOL in seconds — all through Telegram. No counterparty risk, no middlemen.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href={TELEGRAM_URL}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-7 py-3.5 text-base font-semibold text-[var(--accent-ink,#0a0a0a)] transition hover:bg-[var(--accent-hover,#e6b830)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" />
              </svg>
              Start borrowing
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              See how it works
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
            </a>
          </div>
        </div>

        {/* ── Key numbers ── */}
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Approved tokens", value: "64+" },
            { label: "Origination fee", value: "1.5%" },
            { label: "Max LTV", value: "30%" },
            { label: "Fastest loan", value: "~30s" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-4 text-center">
              <div className="font-display text-2xl font-semibold text-[var(--ink)]">{s.value}</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Loan Tiers (LTV explanation) ── */}
        <section className="mt-20">
          <h2 className="text-center font-display text-2xl font-semibold text-[var(--ink)]">
            Pick your loan tier
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[var(--ink-soft)]">
            LTV (Loan-to-Value) is the percentage of your collateral&apos;s value that you can borrow. Higher LTV means more SOL, but less room before liquidation.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className="relative rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-6 transition hover:border-[var(--accent)] hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-semibold text-[var(--ink)]">{t.name}</h3>
                  <span className="rounded-full bg-[var(--accent-dim)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-deep)]">
                    {t.tag}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">{t.desc}</p>

                <div className="mt-5 flex gap-4">
                  <div>
                    <div className="font-display text-3xl font-bold text-[var(--ink)]">{Math.round(t.ltv * 100)}%</div>
                    <div className="text-xs text-[var(--ink-faint)]">LTV</div>
                  </div>
                  <div className="border-l border-[var(--hairline)] pl-4">
                    <div className="font-display text-3xl font-bold text-[var(--ink)]">{t.days}</div>
                    <div className="text-xs text-[var(--ink-faint)]">days</div>
                  </div>
                  <div className="border-l border-[var(--hairline)] pl-4">
                    <div className="font-display text-3xl font-bold text-[var(--ink)]">1.5%</div>
                    <div className="text-xs text-[var(--ink-faint)]">fee</div>
                  </div>
                </div>

                {/* Visual LTV bar */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-[10px] text-[var(--ink-faint)]">
                    <span>Borrowed</span>
                    <span>Collateral buffer</span>
                  </div>
                  <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-[var(--surface)]">
                    <div
                      className="rounded-full transition-all duration-500"
                      style={{ width: `${t.ltv * 100}%`, background: "var(--accent)" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* LTV explainer */}
          <div className="mt-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6">
            <h4 className="font-semibold text-[var(--ink)]">What happens if my collateral drops?</h4>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
              If the value of your collateral falls below <strong>1.1x</strong> the loan amount (the health ratio),
              your position is at risk of liquidation. You can avoid this by topping up collateral, making a partial
              repayment, or extending your loan (1.5% fee per extension). The lower your LTV tier, the more buffer
              you have before liquidation.
            </p>
          </div>
        </section>

        {/* ── Calculator ── */}
        <section className="mt-20">
          <h2 className="text-center font-display text-2xl font-semibold text-[var(--ink)]">
            Estimate your loan
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[var(--ink-soft)]">
            See exactly what you&apos;ll receive before opening the bot.
          </p>
          <div className="mt-8 mx-auto max-w-lg">
            <LoanCalculator />
          </div>
        </section>

        {/* ── How to borrow ── */}
        <section id="how" className="mt-20 scroll-mt-24">
          <h2 className="text-center font-display text-2xl font-semibold text-[var(--ink)]">
            How to request a loan
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-[var(--ink-soft)]">
            The entire process happens in Telegram. Five steps, under a minute.
          </p>

          <div className="mt-10 grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-14">
            {/* Left: steps */}
            <div className="relative">
              <div className="absolute left-5 top-0 hidden h-full w-px bg-[var(--hairline)] sm:block" />

              <div className="flex flex-col gap-6 sm:gap-0">
                {STEPS.map((step) => (
                  <div key={step.num} className="relative flex gap-4 sm:gap-6 sm:pb-10">
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--accent-ink,#0a0a0a)]">
                      {step.num}
                    </div>
                    <div className="flex-1 pb-2">
                      <h3 className="font-semibold text-[var(--ink)]">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{step.desc}</p>
                      {step.cmd && (
                        <code className="mt-2 inline-block rounded-lg bg-[var(--surface)] px-3 py-1.5 text-xs font-mono text-[var(--accent-deep)]">
                          {step.cmd}
                        </code>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Telegram phone mockup */}
            <div className="hidden lg:block lg:sticky lg:top-28">
              <PhoneMock />
            </div>
          </div>

          {/* Mobile: show phone mockup below steps */}
          <div className="mt-10 lg:hidden">
            <PhoneMock />
          </div>
        </section>

        {/* ── Credit Score ── */}
        <section className="mt-20">
          <div className="rounded-3xl border border-[var(--accent)]/25 bg-[var(--accent-dim)]/30 p-8 sm:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
              <div className="flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-deep)]">
                  Better credit = better terms
                </div>
                <h2 className="mt-2 font-display text-2xl font-semibold text-[var(--ink)]">
                  Magpie Credit Score
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
                  Every borrower starts at 500. On-time repayments increase your score; liquidations lower it.
                  Higher scores unlock better LTV, lower fees, and longer terms. Your score is tied to your
                  wallet and builds over time.
                </p>
                <div className="mt-4 text-sm text-[var(--ink-soft)]">
                  <strong className="text-[var(--ink)]">Score factors:</strong> Repayment history (40%), Loan volume (20%),
                  Account age (15%), Collateral diversity (15%), Liquidation history (10%)
                </div>
                <div className="mt-5">
                  <Link
                    href="/credit"
                    className="text-sm font-medium text-[var(--accent-deep)] hover:underline underline-offset-2"
                  >
                    Full credit score breakdown &rarr;
                  </Link>
                </div>
              </div>

              {/* Tier table */}
              <div className="w-full lg:w-auto">
                <div className="overflow-hidden rounded-xl border border-[var(--hairline)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--surface)]">
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Tier</th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Score</th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">LTV</th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Fee</th>
                        <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">Term</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CREDIT_TIERS.map((t) => (
                        <tr key={t.name} className="border-t border-[var(--hairline)]">
                          <td className="px-4 py-2.5 font-medium text-[var(--ink)]">{t.name}</td>
                          <td className="px-4 py-2.5 text-[var(--ink-soft)]">{t.range}</td>
                          <td className="px-4 py-2.5 text-[var(--ink-soft)]">{t.ltv}</td>
                          <td className="px-4 py-2.5 text-[var(--ink-soft)]">{t.fee}</td>
                          <td className="px-4 py-2.5 text-[var(--ink-soft)]">{t.term}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Approved tokens callout ── */}
        <section className="mt-16 flex flex-col items-center gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--bg)] p-8 text-center sm:flex-row sm:text-left">
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold text-[var(--ink)]">64+ approved tokens</h3>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              FARTCOIN, WIF, BONK, POPCAT, PENGU, and dozens more. Each token is risk-assessed in real time by our AI engine.
            </p>
          </div>
          <Link
            href="/tokens"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--hairline)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface)]"
          >
            View all tokens
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </Link>
        </section>

        {/* ── Final CTA ── */}
        <section className="mt-20 text-center">
          <h2 className="font-display text-3xl font-semibold text-[var(--ink)]">
            Ready to borrow?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[var(--ink-soft)]">
            Open the Telegram bot, connect your wallet, and get SOL in under a minute.
            Your memecoins stay on-chain as collateral until you repay.
          </p>
          <a
            href={TELEGRAM_URL}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-8 py-3.5 text-base font-semibold text-[var(--accent-ink,#0a0a0a)] transition hover:bg-[var(--accent-hover,#e6b830)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.95 7.17l-1.95 9.2c-.15.67-.54.83-1.09.52l-3.02-2.22-1.46 1.4c-.16.16-.3.3-.61.3l.22-3.06 5.58-5.04c.24-.22-.05-.34-.38-.13l-6.9 4.34-2.97-.93c-.65-.2-.66-.65.13-.96l11.6-4.47c.54-.2 1.01.13.85.95z" />
            </svg>
            Open Telegram Bot
          </a>
          <div className="mt-4 flex justify-center gap-4 text-xs text-[var(--ink-faint)]">
            <Link href="/docs" className="hover:text-[var(--ink-soft)]">API Docs</Link>
            <span>&middot;</span>
            <Link href="/security" className="hover:text-[var(--ink-soft)]">Security</Link>
            <span>&middot;</span>
            <Link href="/whitepaper" className="hover:text-[var(--ink-soft)]">Whitepaper</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
