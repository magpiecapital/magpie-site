"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { MobileNav } from "@/components/MobileNav";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    step: "01",
    icon: "SOL",
    title: "Borrow SOL",
    desc: "Your loan amount sets your base points.",
  },
  {
    step: "02",
    icon: "\u25B2",
    title: "Choose your tier",
    desc: "Higher risk tiers earn bigger multipliers.",
  },
  {
    step: "03",
    icon: "\u2713",
    title: "Repay on time",
    desc: "Early and on-time repayment adds bonuses.",
  },
  {
    step: "04",
    icon: "\u00D7\u00D7",
    title: "Stack streaks",
    desc: "Consecutive successful loans compound your rewards.",
  },
];

const MULTIPLIER_CARDS = [
  {
    title: "Tier Multiplier",
    icon: "\u25B2",
    rows: [
      { label: "Express (2 days)", value: "1.5\u00D7", note: "High risk, high reward" },
      { label: "Quick (3 days)", value: "1.25\u00D7", note: "Balanced risk" },
      { label: "Standard (7 days)", value: "1.0\u00D7", note: "Safe and steady" },
    ],
  },
  {
    title: "Early Repayment Bonus",
    icon: "\u21E1",
    rows: [
      { label: "Repaid in first half of term", value: "+25%", note: "Repay a 2-day Express in under 24h? That's +25%" },
    ],
  },
  {
    title: "On-Time Bonus",
    icon: "\u2713",
    rows: [
      { label: "Any repayment before due date", value: "+10%", note: "Just don't be late" },
    ],
  },
  {
    title: "Streak Bonus",
    icon: "\uD83D\uDD25",
    isStreak: true,
    rows: [
      { label: "2 consecutive on-time", value: "+10%", note: "" },
      { label: "3 consecutive", value: "+15%", note: "" },
      { label: "5 consecutive", value: "+25%", note: "" },
      { label: "10+ consecutive", value: "+50%", note: "" },
    ],
    footnote: "Your streak resets on a liquidation or late repayment",
  },
  {
    title: "Diversity Bonus",
    icon: "\u2B21",
    rows: [
      { label: "+5% per unique collateral token (lifetime)", value: "Up to +25%", note: "Try new bags, earn more points" },
    ],
    footnote: "Caps at +25% (5 different tokens)",
  },
  {
    title: "First Loan Bonus",
    icon: "\u2606",
    rows: [
      { label: "Complete your first loan", value: "+500 pts", note: "Everyone starts somewhere" },
    ],
  },
  {
    title: "Liquidation",
    icon: "\u26A0",
    negative: true,
    rows: [
      { label: "Loan liquidated", value: "0 pts", note: "No penalty to existing balance, just nothing added" },
    ],
    footnote: "Protect your streak",
  },
];

const LEADERBOARD = [
  { rank: 1, wallet: "7xBm...2pKq", points: 284500, loans: 47, streak: 12 },
  { rank: 2, wallet: "4k2p...9mNz", points: 198200, loans: 34, streak: 8 },
  { rank: 3, wallet: "9fLm...3jKr", points: 156800, loans: 29, streak: 6 },
  { rank: 4, wallet: "2hNp...7wQx", points: 134100, loans: 25, streak: 5 },
  { rank: 5, wallet: "8kRt...1vBz", points: 112400, loans: 22, streak: 4 },
  { rank: 6, wallet: "3mWq...6nYp", points: 98700, loans: 19, streak: 7 },
  { rank: 7, wallet: "5pJk...4rHm", points: 87300, loans: 17, streak: 3 },
  { rank: 8, wallet: "1nBx...8tKw", points: 76500, loans: 15, streak: 5 },
  { rank: 9, wallet: "6wRm...2pLq", points: 65200, loans: 13, streak: 2 },
  { rank: 10, wallet: "4jHn...9kBr", points: 54800, loans: 11, streak: 4 },
];

const COMING_SOON = [
  { title: "Fee Discounts", desc: "Redeem points for reduced origination fees", icon: "%" },
  { title: "Exclusive Tokens", desc: "Early access to newly approved collateral", icon: "\u272A" },
  { title: "Merch & NFTs", desc: "Physical and digital rewards", icon: "\u25C7" },
  { title: "Governance Weight", desc: "Points may influence future protocol decisions", icon: "\u2691" },
];

const FAQ = [
  {
    q: "How do I check my points?",
    a: "Use /points in the Telegram bot.",
  },
  {
    q: "Do points expire?",
    a: "No. Points accumulate indefinitely.",
  },
  {
    q: "What happens to my points if I get liquidated?",
    a: "You earn 0 points for that loan, but your existing balance is unaffected. Your streak resets though.",
  },
  {
    q: "Can I transfer points?",
    a: "Not currently. Points are tied to your Magpie wallet.",
  },
  {
    q: "When can I redeem points?",
    a: "Redemption features are coming soon. Accumulate now.",
  },
];

/* ------------------------------------------------------------------ */
/*  Animated counter                                                   */
/* ------------------------------------------------------------------ */

function AnimatedCounter({ target, duration = 1200, className = "" }: { target: number; duration?: number; className?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          function tick(now: number) {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(target * ease));
            if (t < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
          io.unobserve(el);
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString()}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero points ticker                                                 */
/* ------------------------------------------------------------------ */

function HeroPointsTicker() {
  const [pts, setPts] = useState(14320);

  useEffect(() => {
    const id = setInterval(() => {
      setPts((p) => p + Math.floor(Math.random() * 12) + 3);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex flex-col items-center">
      {/* Glow behind */}
      <div className="absolute inset-0 -m-8 rounded-full bg-[var(--accent)]/10 blur-3xl" />
      <div className="relative flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <Mark size={36} />
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent-deep)]">
            Points
          </span>
        </div>
        <div
          className="font-display tabular text-[clamp(4rem,10vw,8rem)] font-medium leading-none tracking-[-0.04em] text-[var(--accent-deep)]"
          style={{ transition: "all 0.4s ease" }}
        >
          {pts.toLocaleString()}
        </div>
        <div className="text-sm text-[var(--ink-faint)]">pts</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated bar                                                       */
/* ------------------------------------------------------------------ */

function AnimatedBar({ pct, delay = 0 }: { pct: number; delay?: number }) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setTimeout(() => setInView(true), delay);
          io.unobserve(el);
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface)]">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: inView ? `${Math.min(pct, 100)}%` : "0%",
          background: "linear-gradient(90deg, #c99a2c, #f7c948)",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Points Calculator                                                  */
/* ------------------------------------------------------------------ */

type Tier = "express" | "quick" | "standard";

function PointsCalculator() {
  const [loanAmount, setLoanAmount] = useState(5);
  const [tier, setTier] = useState<Tier>("express");
  const [earlyRepay, setEarlyRepay] = useState(true);
  const [onTime, setOnTime] = useState(true);
  const [streak, setStreak] = useState(3);
  const [uniqueTokens, setUniqueTokens] = useState(4);
  const [firstLoan, setFirstLoan] = useState(false);

  const tierMult = tier === "express" ? 1.5 : tier === "quick" ? 1.25 : 1.0;
  const tierLabel = tier === "express" ? "Express" : tier === "quick" ? "Quick" : "Standard";
  const earlyMult = earlyRepay ? 1.25 : 1.0;
  const onTimeMult = onTime ? 1.10 : 1.0;
  const streakMult =
    streak >= 10 ? 1.5 : streak >= 5 ? 1.25 : streak >= 3 ? 1.15 : streak >= 2 ? 1.10 : 1.0;
  const diversityMult = 1 + Math.min(uniqueTokens, 5) * 0.05;
  const firstLoanBonus = firstLoan ? 500 : 0;

  const base = loanAmount * 100;
  const afterTier = base * tierMult;
  const afterEarly = afterTier * earlyMult;
  const afterOnTime = afterEarly * onTimeMult;
  const afterStreak = afterOnTime * streakMult;
  const afterDiversity = afterStreak * diversityMult;
  const total = Math.round(afterDiversity) + firstLoanBonus;

  const steps = useMemo(
    () => [
      { label: "Base", formula: `${loanAmount} \u00D7 100`, value: base },
      { label: `Tier (${tierLabel})`, formula: `\u00D7 ${tierMult}`, value: Math.round(afterTier) },
      ...(earlyRepay
        ? [{ label: "Early repay", formula: "\u00D7 1.25", value: Math.round(afterEarly) }]
        : []),
      ...(onTime
        ? [{ label: "On-time", formula: "\u00D7 1.10", value: Math.round(afterOnTime) }]
        : []),
      ...(streak >= 2
        ? [{ label: `Streak (${streak}\u00D7)`, formula: `\u00D7 ${streakMult}`, value: Math.round(afterStreak) }]
        : []),
      ...(uniqueTokens > 0
        ? [{ label: `Diversity (${Math.min(uniqueTokens, 5)})`, formula: `\u00D7 ${diversityMult.toFixed(2)}`, value: Math.round(afterDiversity) }]
        : []),
      ...(firstLoan
        ? [{ label: "First loan", formula: "+ 500", value: Math.round(afterDiversity) + 500 }]
        : []),
    ],
    [loanAmount, tier, earlyRepay, onTime, streak, uniqueTokens, firstLoan, base, tierMult, tierLabel, earlyMult, onTimeMult, streakMult, diversityMult, afterTier, afterEarly, afterOnTime, afterStreak, afterDiversity],
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Controls */}
      <div className="flex flex-col gap-6">
        {/* Loan amount */}
        <div>
          <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            Loan Amount (SOL)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0.1}
              max={50}
              step={0.1}
              value={loanAmount}
              onChange={(e) => setLoanAmount(parseFloat(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <div className="tabular min-w-[60px] rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-center text-sm font-semibold">
              {loanAmount.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Tier */}
        <div>
          <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            Tier
          </label>
          <div className="flex gap-2">
            {(["express", "quick", "standard"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold capitalize transition ${
                  tier === t
                    ? "border-[var(--accent-deep)] bg-[var(--accent-dim)] text-[var(--accent-deep)]"
                    : "border-[var(--hairline)] bg-[var(--bg-elevated)] text-[var(--ink-soft)] hover:border-[var(--hairline-strong)]"
                }`}
              >
                {t}
                <span className="mt-0.5 block text-[10px] font-normal text-[var(--ink-faint)]">
                  {t === "express" ? "1.5\u00D7" : t === "quick" ? "1.25\u00D7" : "1.0\u00D7"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-4">
          <ToggleSwitch label="Early repayment" value={earlyRepay} onChange={setEarlyRepay} />
          <ToggleSwitch label="On-time" value={onTime} onChange={setOnTime} />
          <ToggleSwitch label="First loan" value={firstLoan} onChange={setFirstLoan} />
        </div>

        {/* Streak */}
        <div>
          <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            Current Streak
          </label>
          <select
            value={streak}
            onChange={(e) => setStreak(parseInt(e.target.value))}
            className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-4 py-3 text-sm font-semibold text-[var(--ink)] transition focus:border-[var(--accent-deep)] focus:outline-none"
          >
            <option value={0}>0 (no streak)</option>
            <option value={1}>1</option>
            <option value={2}>2 (+10%)</option>
            <option value={3}>3 (+15%)</option>
            <option value={5}>5 (+25%)</option>
            <option value={10}>10+ (+50%)</option>
          </select>
        </div>

        {/* Unique tokens */}
        <div>
          <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            Unique Tokens Used
          </label>
          <select
            value={uniqueTokens}
            onChange={(e) => setUniqueTokens(parseInt(e.target.value))}
            className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-4 py-3 text-sm font-semibold text-[var(--ink)] transition focus:border-[var(--accent-deep)] focus:outline-none"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} token{n > 1 ? "s" : ""} (+{n * 5}%)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-col rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 md:p-8">
        <div className="mb-6 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
          Calculation breakdown
        </div>

        <div className="flex flex-col gap-3">
          {steps.map((s, i) => {
            const maxVal = total || 1;
            const barPct = (s.value / maxVal) * 100;
            return (
              <div key={s.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--ink-soft)]">{s.label}</span>
                  <span className="font-mono text-xs text-[var(--ink-faint)]">{s.formula}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface)]">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${barPct}%`,
                        background:
                          i === steps.length - 1
                            ? "linear-gradient(90deg, #c99a2c, #f7c948)"
                            : "linear-gradient(90deg, rgba(201,154,44,0.3), rgba(247,201,72,0.5))",
                      }}
                    />
                  </div>
                  <span className="tabular min-w-[70px] text-right text-sm font-semibold">
                    {s.value.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-6 border-t border-dashed border-[var(--hairline-strong)]" />

        {/* Total */}
        <div className="flex items-end justify-between">
          <span className="text-sm font-semibold text-[var(--ink-soft)]">Total</span>
          <div className="text-right">
            <AnimatedCounter
              key={total}
              target={total}
              duration={800}
              className="font-display tabular text-5xl font-medium tracking-[-0.04em] text-[var(--accent-deep)]"
            />
            <div className="mt-1 text-sm text-[var(--ink-faint)]">pts</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle switch                                                      */
/* ------------------------------------------------------------------ */

function ToggleSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
        value
          ? "border-[var(--accent-deep)] bg-[var(--accent-dim)] text-[var(--accent-deep)]"
          : "border-[var(--hairline)] bg-[var(--bg-elevated)] text-[var(--ink-soft)]"
      }`}
    >
      <span>{label}</span>
      <div
        className={`relative h-5 w-9 rounded-full transition-colors ${
          value ? "bg-[var(--accent)]" : "bg-[var(--hairline-strong)]"
        }`}
      >
        <div
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: value ? "translateX(16px)" : "translateX(2px)" }}
        />
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Leaderboard                                                        */
/* ------------------------------------------------------------------ */

function Leaderboard() {
  const rankColors: Record<number, string> = {
    1: "#f7c948",    // gold
    2: "#a8acb4",    // silver
    3: "#cd7f32",    // bronze
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr>
            {["Rank", "Wallet", "Points", "Loans", "Streak"].map((h) => (
              <th
                key={h}
                className="border-b border-[var(--hairline-strong)] pb-4 text-left text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LEADERBOARD.map((row) => {
            const color = rankColors[row.rank];
            return (
              <tr key={row.rank} className="group">
                <td className="border-b border-[var(--hairline)] py-4 group-last:border-0">
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      backgroundColor: color ? `${color}20` : "var(--surface)",
                      color: color || "var(--ink-soft)",
                      border: color ? `1px solid ${color}40` : undefined,
                    }}
                  >
                    {row.rank}
                  </span>
                </td>
                <td className="border-b border-[var(--hairline)] py-4 font-mono text-sm text-[var(--ink)] group-last:border-0">
                  {row.wallet}
                </td>
                <td className="border-b border-[var(--hairline)] py-4 group-last:border-0">
                  <span className="tabular font-semibold" style={{ color: color || "var(--ink)" }}>
                    {row.points.toLocaleString()}
                  </span>
                </td>
                <td className="tabular border-b border-[var(--hairline)] py-4 text-sm text-[var(--ink-soft)] group-last:border-0">
                  {row.loans}
                </td>
                <td className="border-b border-[var(--hairline)] py-4 group-last:border-0">
                  <span className="tabular text-sm font-semibold text-[var(--ink)]">
                    {row.streak}
                  </span>
                  <span className="ml-0.5" role="img" aria-label="fire">
                    {"\uD83D\uDD25"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-4 text-center text-sm text-[var(--ink-faint)]">
        Leaderboard updates in real-time. Check your rank with <code className="font-mono text-[var(--accent-deep)]">/points</code> in the bot.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function PointsClient() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-[var(--hairline)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <MobileNav />
            <Link href="/"><Wordmark size={28} /></Link>
          </div>
          <nav className="flex items-center gap-8">
            <Link href="/tokens" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Tokens
            </Link>
            <Link href="/calculate" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Calculator
            </Link>
            <Link href="/credit" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Credit
            </Link>
            <Link href="/stats" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Stats
            </Link>
            <Link href="/docs" className="hidden text-sm font-medium text-[var(--ink-soft)] transition hover:text-[var(--ink)] md:inline">
              Docs
            </Link>
            <a href={TELEGRAM_URL} className="btn-accent text-sm">Launch</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-20 md:pt-28 md:pb-32">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-20">
            <div>
              <div className="fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium shadow-sm">
                <span className="live-dot" />
                <span className="text-[var(--ink)]">Rewards</span>
              </div>
              <h1 className="fade-up fade-up-1 font-display text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] tracking-[-0.04em] font-medium">
                Earn Points.
                <br />
                <span className="italic text-[var(--accent-deep)]">Every Loan.</span>
              </h1>
              <p className="fade-up fade-up-2 mt-8 max-w-lg text-lg text-[var(--ink-soft)] leading-relaxed">
                Every successful repayment earns you Magpie Points. Bigger loans, riskier tiers, and repayment streaks multiply your rewards. Accumulate now &mdash; redemptions coming soon.
              </p>
              <div className="fade-up fade-up-3 mt-10 flex flex-wrap items-center gap-4">
                <a href={TELEGRAM_URL} className="btn-accent text-base">
                  Start earning
                  <span aria-hidden>&#8594;</span>
                </a>
                <a href="#calculator" className="btn-ghost text-base">
                  Calculate rewards
                </a>
              </div>
            </div>
            <div className="fade-up fade-up-3 flex justify-center">
              <HeroPointsTicker />
            </div>
          </div>
        </div>
      </section>

      {/* How Points Work */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">How it works</div>
            <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-7xl">
              Four steps to <span className="italic text-[var(--ink-soft)]">earning.</span>
            </h2>
          </Reveal>

          <div className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.step} delay={i * 100}>
                <div className="group relative flex h-full flex-col rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-7 transition hover:border-[var(--ink)] hover:shadow-md">
                  {i < 3 && (
                    <div className="absolute -right-3 top-1/2 hidden h-px w-6 bg-[var(--hairline-strong)] md:block" />
                  )}
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface)] text-lg font-semibold text-[var(--accent-deep)] transition group-hover:bg-[var(--accent)] group-hover:text-[var(--ink)]">
                    {s.icon}
                  </div>
                  <div className="mt-5 font-mono text-xs text-[var(--ink-faint)]">{s.step}</div>
                  <div className="mt-2 text-xl font-semibold tracking-tight">{s.title}</div>
                  <div className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{s.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Points Formula */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <Reveal>
          <div className="chip mb-5">Formula</div>
          <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
            Points breakdown.
          </h2>
          <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-[var(--accent-deep)]/30 bg-[var(--accent-dim)] px-6 py-4">
            <span className="text-sm font-medium text-[var(--accent-deep)]">Base Points</span>
            <span className="font-display text-2xl font-medium text-[var(--accent-deep)]">=</span>
            <span className="font-display text-2xl font-medium text-[var(--accent-deep)]">
              Loan Amount (SOL) &times; 100
            </span>
          </div>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {MULTIPLIER_CARDS.map((card, ci) => (
            <Reveal key={card.title} delay={ci * 80}>
              <div
                className={`flex h-full flex-col rounded-2xl border p-6 transition hover:shadow-md ${
                  card.negative
                    ? "border-[var(--bad)]/20 bg-[rgba(184,58,58,0.04)] hover:border-[var(--bad)]/40"
                    : card.isStreak
                    ? "border-[var(--accent-deep)]/30 bg-gradient-to-b from-[var(--bg-elevated)] to-[var(--accent-dim)]/30 hover:border-[var(--accent-deep)]"
                    : "border-[var(--hairline)] bg-[var(--bg-elevated)] hover:border-[var(--hairline-strong)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-base ${
                      card.negative
                        ? "bg-[rgba(184,58,58,0.1)] text-[var(--bad)]"
                        : "bg-[var(--accent-dim)] text-[var(--accent-deep)]"
                    }`}
                  >
                    {card.icon}
                  </div>
                  <div className="text-lg font-semibold tracking-tight">{card.title}</div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  {card.rows.map((row, ri) => (
                    <div key={ri} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--ink-soft)]">{row.label}</span>
                        <span
                          className={`tabular text-sm font-bold ${
                            card.negative ? "text-[var(--bad)]" : "text-[var(--accent-deep)]"
                          }`}
                        >
                          {row.value}
                        </span>
                      </div>
                      {row.note && (
                        <div className="text-xs italic text-[var(--ink-faint)]">{row.note}</div>
                      )}
                      {card.isStreak && (
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent)]"
                            style={{ width: `${((ri + 1) / card.rows.length) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {card.footnote && (
                  <div className={`mt-auto pt-4 text-xs italic ${card.negative ? "text-[var(--bad)]/70" : "text-[var(--ink-faint)]"}`}>
                    {card.footnote}
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Points Calculator */}
      <section id="calculator" className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">Simulate</div>
            <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
              Points calculator.
            </h2>
            <p className="mt-6 max-w-xl text-lg text-[var(--ink-soft)] leading-relaxed">
              See exactly how many points a loan would earn you. Tweak the inputs and watch the numbers stack.
            </p>
          </Reveal>

          <div className="mt-16">
            <PointsCalculator />
          </div>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <Reveal>
          <div className="chip mb-5">Leaderboard</div>
          <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
            Top earners.
          </h2>
          <p className="mt-6 max-w-xl text-lg text-[var(--ink-soft)] leading-relaxed">
            The sharpest borrowers on Magpie. Where do you rank?
          </p>
        </Reveal>

        <div className="mt-16 rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 md:p-8">
          <Leaderboard />
        </div>
      </section>

      {/* Coming Soon */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">Redemptions</div>
            <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
              Coming soon.
            </h2>
            <p className="mt-6 max-w-xl text-lg text-[var(--ink-soft)] leading-relaxed">
              Points will unlock real value. Here is what is on the roadmap.
            </p>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {COMING_SOON.map((card, i) => (
              <Reveal key={card.title} delay={i * 100}>
                <div className="group relative flex h-full flex-col items-center rounded-3xl border border-[var(--hairline)] bg-[var(--surface)]/50 p-7 text-center opacity-70 transition hover:opacity-90">
                  {/* Lock overlay */}
                  <div className="absolute right-4 top-4 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                    Coming Soon
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface)] text-2xl text-[var(--ink-faint)]">
                    {card.icon}
                  </div>
                  <div className="mt-5 text-lg font-semibold tracking-tight text-[var(--ink-soft)]">
                    {card.title}
                  </div>
                  <div className="mt-2 text-sm leading-relaxed text-[var(--ink-faint)]">
                    {card.desc}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <Reveal>
          <div className="chip mb-5">Questions</div>
          <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
            Points FAQ.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-x-16 gap-y-10 md:grid-cols-2">
          {FAQ.map((item, i) => (
            <Reveal key={item.q} delay={(i % 2) * 80}>
              <div>
                <div className="flex items-start gap-3">
                  <span className="font-mono text-sm text-[var(--accent-deep)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="text-xl font-semibold tracking-tight">{item.q}</div>
                </div>
                <div className="mt-3 pl-9 text-base leading-relaxed text-[var(--ink-soft)]">
                  {item.a}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-[var(--hairline)] bg-[var(--ink)] text-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--accent)]/20 blur-3xl drift" />
          <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-[var(--accent-deep)]/15 blur-3xl drift" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-28 text-center md:py-36">
          <h2 className="font-display mx-auto max-w-4xl text-5xl font-medium tracking-[-0.04em] text-white md:text-7xl">
            Start earning points
            <br />
            <span className="italic text-[var(--accent)]">today.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg text-white/70">
            Every loan is an opportunity. Bigger loans, faster repayments, and streaks all stack in your favor.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a href={TELEGRAM_URL} className="btn-accent text-lg">
              Launch on Telegram
              <span aria-hidden>&#8594;</span>
            </a>
            <Link
              href="/credit"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              View credit system
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hairline)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="text-xs text-[var(--ink-soft)]">
              &copy; {new Date().getFullYear()} Magpie &middot; Built on Solana
            </div>
            <div className="text-xs text-[var(--ink-faint)]">
              Points are non-transferable and subject to change. Not financial advice.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
