"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { Header } from "@/components/Header";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const SCORE_FACTORS = [
  {
    label: "Repayment History",
    pct: 40,
    color: "var(--accent)",
    icon: "✓",
    desc: "On-time repayments vs late or liquidated positions. The single biggest factor in your score.",
  },
  {
    label: "Loan Volume",
    pct: 20,
    color: "var(--accent-deep)",
    icon: "◆",
    desc: "Total SOL borrowed over the lifetime of your account. Larger, completed loans signal reliability.",
  },
  {
    label: "Account Age",
    pct: 15,
    color: "#b8956a",
    icon: "◷",
    desc: "Time since your first loan. Longer history gives the algorithm more data to trust.",
  },
  {
    label: "Collateral Diversity",
    pct: 15,
    color: "#a8a49a",
    icon: "⬡",
    desc: "Number of different tokens used as collateral. Diversified borrowers are lower-risk.",
  },
  {
    label: "Liquidation History",
    pct: 10,
    color: "var(--bad)",
    icon: "⚠",
    desc: "Fewer liquidations = higher score. Each liquidation weighs against your reputation.",
  },
];

const TIERS = [
  {
    name: "Bronze",
    range: "300 – 499",
    subtitle: "Getting Started",
    ltv: "20 – 30%",
    fee: "1.5%",
    term: "7 days",
    perks: ["Standard LTV rates", "1.5% origination fee", "Standard loan terms"],
    color: "#cd7f32",
    colorDim: "rgba(205,127,50,0.12)",
    borderColor: "rgba(205,127,50,0.3)",
  },
  {
    name: "Silver",
    range: "500 – 649",
    subtitle: "Established",
    ltv: "22 – 32%",
    fee: "1.5%",
    term: "7 days",
    perks: ["+2% LTV bonus", "1.5% origination fee", "Priority support"],
    color: "#a8acb4",
    colorDim: "rgba(168,172,180,0.12)",
    borderColor: "rgba(168,172,180,0.3)",
  },
  {
    name: "Gold",
    range: "650 – 749",
    subtitle: "Trusted",
    ltv: "25 – 35%",
    fee: "1.25%",
    term: "14 days",
    perks: ["+5% LTV bonus", "1.25% reduced fee", "Extended terms (14 days)", "Exclusive token access"],
    color: "var(--accent)",
    colorDim: "var(--accent-dim)",
    borderColor: "var(--accent-deep)",
    highlight: true,
  },
  {
    name: "Platinum",
    range: "750 – 850",
    subtitle: "Elite",
    ltv: "28 – 38%",
    fee: "1.0%",
    term: "30 days",
    perks: ["+8% LTV bonus", "1.0% reduced fee", "Custom terms (30 days)", "Early access to features", "Dedicated support"],
    color: "#e8e6e0",
    colorDim: "rgba(232,230,224,0.15)",
    borderColor: "rgba(232,230,224,0.4)",
    premium: true,
  },
];

const SIM_ACTIONS = [
  { label: "On-time repayment", delta: +15, positive: true },
  { label: "Early repayment", delta: +20, positive: true },
  { label: "Large loan completed", delta: +10, positive: true },
  { label: "New token used", delta: +5, positive: true },
  { label: "Late repayment", delta: -25, positive: false },
  { label: "Liquidation", delta: -50, positive: false },
];

const COMPARISON = [
  { label: "Max LTV", bronze: "30%", silver: "32%", gold: "35%", platinum: "38%" },
  { label: "Fee", bronze: "1.5%", silver: "1.5%", gold: "1.25%", platinum: "1.0%" },
  { label: "Max Term", bronze: "7 days", silver: "7 days", gold: "14 days", platinum: "30 days" },
  { label: "Priority Support", bronze: false, silver: true, gold: true, platinum: true },
  { label: "Exclusive Tokens", bronze: false, silver: false, gold: true, platinum: true },
  { label: "Custom Terms", bronze: false, silver: false, gold: false, platinum: true },
];

const FAQ = [
  {
    q: "How do I check my credit score?",
    a: "Use the /credit command in the Magpie Telegram bot. Your score, tier, and full history are available anytime.",
  },
  {
    q: "Can my score go down?",
    a: "Yes. Liquidations and late repayments lower your score. The algorithm weighs recent activity more heavily, so consistent on-time repayments can recover a drop.",
  },
  {
    q: "Does my score transfer?",
    a: "Your score is tied to your Magpie wallet, which you own. Since wallets are non-custodial and exportable, your credit reputation goes wherever your keys go.",
  },
  {
    q: "How fast can I reach Platinum?",
    a: "It depends on loan frequency and repayment consistency. Most active users reach Gold within 2–3 months. Platinum requires sustained, high-volume activity with zero liquidations.",
  },
];

/* ------------------------------------------------------------------ */
/*  Animated credit gauge                                              */
/* ------------------------------------------------------------------ */

function CreditGauge({ score }: { score: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const [displayed, setDisplayed] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const start = performance.now();
    const duration = 1800;
    const from = 300;
    const to = score;

    function tick(now: number) {
      if (!mounted.current) return;
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (to - from) * ease);
      setDisplayed(current);
      draw(current);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    }

    function draw(val: number) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const size = 280;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2 + 10;
      const r = 110;
      const lineW = 14;
      const startA = Math.PI * 0.8;
      const endA = Math.PI * 2.2;
      const range = endA - startA;

      // Background track
      ctx.beginPath();
      ctx.arc(cx, cy, r, startA, endA);
      ctx.strokeStyle = "rgba(168,164,154,0.15)";
      ctx.lineWidth = lineW;
      ctx.lineCap = "round";
      ctx.stroke();

      // Score arc
      const pct = Math.max(0, Math.min(1, (val - 300) / 550));
      const scoreAngle = startA + range * pct;
      const grad = ctx.createLinearGradient(0, size, size, 0);
      grad.addColorStop(0, "#c99a2c");
      grad.addColorStop(0.5, "#f7c948");
      grad.addColorStop(1, "#ffd668");
      ctx.beginPath();
      ctx.arc(cx, cy, r, startA, scoreAngle);
      ctx.strokeStyle = grad;
      ctx.lineWidth = lineW;
      ctx.lineCap = "round";
      ctx.stroke();

      // Glow
      ctx.beginPath();
      ctx.arc(cx, cy, r, startA, scoreAngle);
      ctx.strokeStyle = "rgba(247,201,72,0.25)";
      ctx.lineWidth = lineW + 12;
      ctx.lineCap = "round";
      ctx.stroke();

      // Tick marks
      const ticks = [300, 400, 500, 600, 700, 800, 850];
      ticks.forEach((t) => {
        const tp = (t - 300) / 550;
        const ta = startA + range * tp;
        const inner = r - lineW / 2 - 6;
        const outer = r - lineW / 2 - 14;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ta) * inner, cy + Math.sin(ta) * inner);
        ctx.lineTo(cx + Math.cos(ta) * outer, cy + Math.sin(ta) * outer);
        ctx.strokeStyle = "rgba(168,164,154,0.3)";
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.stroke();
      });

      // Needle dot
      const dotR = 6;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(scoreAngle) * r, cy + Math.sin(scoreAngle) * r, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#f7c948";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + Math.cos(scoreAngle) * r, cy + Math.sin(scoreAngle) * r, dotR + 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(247,201,72,0.3)";
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      mounted.current = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [score]);

  const tier = displayed >= 750 ? "Platinum" : displayed >= 650 ? "Gold" : displayed >= 500 ? "Silver" : "Bronze";

  return (
    <div className="relative flex flex-col items-center">
      <canvas ref={canvasRef} className="w-[280px] h-[280px]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-5">
        <div className="font-display tabular text-7xl font-medium tracking-[-0.04em]">{displayed}</div>
        <div className="mt-1 text-sm font-semibold tracking-wide text-[var(--accent-deep)]">{tier}</div>
      </div>
      <div className="mt-2 flex w-full max-w-[260px] justify-between px-2 text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
        <span>300</span>
        <span>850</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Score simulator                                                    */
/* ------------------------------------------------------------------ */

function ScoreSimulator() {
  const [score, setScore] = useState(500);
  const [history, setHistory] = useState<{ label: string; delta: number }[]>([]);

  const applyAction = useCallback((action: typeof SIM_ACTIONS[number]) => {
    setScore((s) => Math.max(300, Math.min(850, s + action.delta)));
    setHistory((h) => [{ label: action.label, delta: action.delta }, ...h].slice(0, 8));
  }, []);

  const reset = useCallback(() => {
    setScore(500);
    setHistory([]);
  }, []);

  const tier = score >= 750 ? "Platinum" : score >= 650 ? "Gold" : score >= 500 ? "Silver" : "Bronze";
  const tierColor =
    score >= 750 ? "#e8e6e0" : score >= 650 ? "var(--accent)" : score >= 500 ? "#a8acb4" : "#cd7f32";

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="text-sm font-medium text-[var(--ink-soft)]">Tap actions to see how they affect your score:</div>
        <div className="flex flex-wrap gap-3">
          {SIM_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => applyAction(a)}
              className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${
                a.positive
                  ? "border-[var(--accent-deep)]/30 bg-[var(--accent-dim)] text-[var(--accent-deep)] hover:border-[var(--accent-deep)] hover:bg-[var(--accent)]/20"
                  : "border-[var(--bad)]/20 bg-[rgba(184,58,58,0.06)] text-[var(--bad)] hover:border-[var(--bad)] hover:bg-[rgba(184,58,58,0.12)]"
              }`}
            >
              {a.positive ? "+" : ""}{a.delta} {a.label}
            </button>
          ))}
        </div>
        <button
          onClick={reset}
          className="mt-2 self-start text-sm font-medium text-[var(--ink-faint)] underline underline-offset-4 hover:text-[var(--ink-soft)]"
        >
          Reset to 500
        </button>

        {/* History log */}
        {history.length > 0 && (
          <div className="mt-4 flex flex-col gap-1.5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">Recent actions</div>
            {history.map((h, i) => (
              <div
                key={`${h.label}-${i}`}
                className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-3 py-2 text-sm"
                style={{
                  opacity: 1 - i * 0.1,
                  animation: i === 0 ? "fadeUp 0.3s ease both" : undefined,
                }}
              >
                <span className="text-[var(--ink-soft)]">{h.label}</span>
                <span
                  className="tabular font-semibold"
                  style={{ color: h.delta > 0 ? "var(--accent-deep)" : "var(--bad)" }}
                >
                  {h.delta > 0 ? "+" : ""}{h.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Score display */}
      <div className="flex flex-col items-center justify-center rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-8">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">Simulated score</div>
        <div className="font-display tabular text-8xl font-medium tracking-[-0.04em]" style={{ transition: "all 0.3s ease" }}>
          {score}
        </div>
        <div
          className="mt-2 rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-[0.1em]"
          style={{
            color: tier === "Platinum" ? "var(--ink)" : tier === "Gold" ? "var(--accent-ink)" : "var(--ink)",
            backgroundColor: tier === "Bronze" ? "rgba(205,127,50,0.15)" : tier === "Silver" ? "rgba(168,172,180,0.15)" : tier === "Gold" ? "var(--accent-dim)" : "rgba(232,230,224,0.2)",
            border: `1px solid ${tierColor}`,
          }}
        >
          {tier}
        </div>
        {/* Mini progress bar */}
        <div className="mt-6 w-full max-w-[240px]">
          <div className="h-2 w-full rounded-full bg-[var(--surface)]">
            <div
              className="h-2 rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${((score - 300) / 550) * 100}%`,
                background: `linear-gradient(90deg, #c99a2c, #f7c948)`,
              }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-[var(--ink-faint)]">
            <span>300</span>
            <span>850</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Factor bar chart                                                   */
/* ------------------------------------------------------------------ */

function FactorBar({ factor, delay }: { factor: typeof SCORE_FACTORS[number]; delay: number }) {
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
    <div ref={ref} className="group flex flex-col gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-5 transition hover:border-[var(--hairline-strong)] hover:shadow-sm md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
            style={{ backgroundColor: `color-mix(in srgb, ${factor.color} 15%, transparent)`, color: factor.color }}
          >
            {factor.icon}
          </div>
          <div className="font-semibold tracking-tight">{factor.label}</div>
        </div>
        <div className="font-display tabular text-2xl font-medium tracking-[-0.02em]" style={{ color: factor.color }}>
          {factor.pct}%
        </div>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface)]">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: inView ? `${factor.pct * 2.5}%` : "0%",
            backgroundColor: factor.color,
          }}
        />
      </div>
      <div className="text-sm leading-relaxed text-[var(--ink-soft)]">{factor.desc}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function CreditClient() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow" />
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-20 md:pt-28 md:pb-32">
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-20">
            <div>
              <div className="fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium shadow-sm">
                <span className="live-dot" />
                <span className="text-[var(--ink)]">First in DeFi</span>
              </div>
              <h1 className="fade-up fade-up-1 font-display text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] tracking-[-0.04em] font-medium">
                Build Your Credit.
                <br />
                <span className="italic text-[var(--accent-deep)]">Unlock Better Rates.</span>
              </h1>
              <p className="fade-up fade-up-2 mt-8 max-w-lg text-lg text-[var(--ink-soft)] leading-relaxed">
                The first on-chain credit system for memecoin lending. Every on-time repayment builds your score — and your rewards.
              </p>
              <div className="fade-up fade-up-3 mt-10 flex flex-wrap items-center gap-4">
                <a href={TELEGRAM_URL} className="btn-accent text-base">
                  Start building credit
                  <span aria-hidden>→</span>
                </a>
                <a href="#how" className="btn-ghost text-base">
                  How it works
                </a>
              </div>
            </div>
            <div className="fade-up fade-up-3 flex justify-center">
              <CreditGauge score={720} />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">How it works</div>
            <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-7xl">
              Every loan is a <span className="italic text-[var(--ink-soft)]">building block.</span>
            </h2>
          </Reveal>

          <div className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-4">
            {[
              {
                step: "01",
                title: "Borrow",
                desc: "Your first loan starts your credit history. Every borrower begins at 500.",
                icon: "↗",
              },
              {
                step: "02",
                title: "Repay on time",
                desc: "Each successful repayment boosts your score. Early repayment earns bonus points.",
                icon: "✓",
              },
              {
                step: "03",
                title: "Level up",
                desc: "Higher scores unlock better LTV ratios, lower fees, and longer loan terms.",
                icon: "△",
              },
              {
                step: "04",
                title: "Build reputation",
                desc: "Your on-chain credit follows you. A portable, verifiable lending reputation.",
                icon: "◈",
              },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 100}>
                <div className="group relative flex h-full flex-col rounded-3xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-7 transition hover:border-[var(--ink)] hover:shadow-md">
                  {/* Connector line */}
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

      {/* Score Breakdown */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <Reveal>
          <div className="chip mb-5">Score factors</div>
          <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
            Five factors. <span className="italic text-[var(--ink-soft)]">One score.</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg text-[var(--ink-soft)] leading-relaxed">
            Your Magpie credit score is calculated from five on-chain factors, weighted by their predictive value.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SCORE_FACTORS.map((f, i) => (
            <FactorBar key={f.label} factor={f} delay={i * 80} />
          ))}
          {/* Total card */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--accent-deep)]/30 bg-[var(--accent-dim)] p-6">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent-deep)]">Total weight</div>
            <div className="font-display tabular mt-2 text-5xl font-medium tracking-[-0.03em] text-[var(--accent-deep)]">
              100%
            </div>
            <div className="mt-2 text-sm text-[var(--accent-deep)]/70">All factors combined</div>
          </div>
        </div>
      </section>

      {/* Credit Tiers */}
      <section className="border-y border-[var(--hairline)] bg-[var(--bg-elevated)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">Credit tiers</div>
            <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-7xl">
              Climb higher. <span className="italic text-[var(--ink-soft)]">Borrow better.</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((tier, i) => (
              <Reveal key={tier.name} delay={i * 100}>
                <div
                  className={`relative flex h-full flex-col rounded-3xl border p-7 transition hover:shadow-lg ${
                    tier.highlight
                      ? "border-[var(--accent-deep)] shadow-[0_20px_60px_-20px_rgba(247,201,72,0.25)]"
                      : tier.premium
                      ? "border-[rgba(232,230,224,0.4)] bg-gradient-to-b from-[var(--bg-elevated)] to-[var(--surface)]"
                      : "border-[var(--hairline)] bg-[var(--bg-elevated)] hover:border-[var(--hairline-strong)]"
                  }`}
                  style={{
                    background: tier.highlight
                      ? `linear-gradient(180deg, var(--bg-elevated) 0%, color-mix(in srgb, var(--accent-dim) 50%, var(--bg-elevated)) 100%)`
                      : undefined,
                  }}
                >
                  {tier.highlight && (
                    <span className="absolute -top-3 left-7 rounded-full bg-[var(--accent)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink)] shadow-sm">
                      Most popular
                    </span>
                  )}
                  {tier.premium && (
                    <span className="absolute -top-3 left-7 rounded-full bg-[var(--ink)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--bg-elevated)] shadow-sm">
                      Elite
                    </span>
                  )}

                  {/* Tier icon */}
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-bold"
                    style={{ backgroundColor: tier.colorDim, color: tier.color }}
                  >
                    {tier.name[0]}
                  </div>

                  <div className="mt-5">
                    <div className="text-2xl font-semibold tracking-tight">{tier.name}</div>
                    <div className="mt-0.5 text-sm text-[var(--ink-soft)]">{tier.subtitle}</div>
                  </div>

                  <div className="mt-5 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">Score range</div>
                    <div className="font-display tabular mt-1 text-2xl font-medium tracking-[-0.02em]">{tier.range}</div>
                  </div>

                  <div className="mt-5 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-soft)]">LTV</span>
                      <span className="font-semibold">{tier.ltv}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-soft)]">Fee</span>
                      <span className="font-semibold">{tier.fee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-soft)]">Max term</span>
                      <span className="font-semibold">{tier.term}</span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-[var(--hairline)] pt-5">
                    <ul className="space-y-2">
                      {tier.perks.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
                          <span
                            className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px]"
                            style={{ backgroundColor: tier.colorDim, color: tier.color }}
                          >
                            ✓
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Score Simulator */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <Reveal>
          <div className="chip mb-5">Try it</div>
          <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
            Score simulator.
          </h2>
          <p className="mt-6 max-w-xl text-lg text-[var(--ink-soft)] leading-relaxed">
            See how different actions affect your credit score. Every on-time repayment pushes you toward better rates.
          </p>
        </Reveal>

        <div className="mt-16">
          <ScoreSimulator />
        </div>
      </section>

      {/* Comparison Table */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-28 md:py-36">
          <Reveal>
            <div className="chip mb-5">Benefits</div>
            <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
              What each tier <span className="italic text-[var(--ink-soft)]">unlocks.</span>
            </h2>
          </Reveal>

          <Reveal delay={100}>
            <div className="mt-16 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr>
                    <th className="border-b border-[var(--hairline-strong)] pb-4 text-left text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                      Benefit
                    </th>
                    <th className="border-b border-[var(--hairline-strong)] pb-4 text-center text-[10px] uppercase tracking-[0.22em]" style={{ color: "#cd7f32" }}>
                      Bronze
                    </th>
                    <th className="border-b border-[var(--hairline-strong)] pb-4 text-center text-[10px] uppercase tracking-[0.22em]" style={{ color: "#a8acb4" }}>
                      Silver
                    </th>
                    <th className="border-b border-[var(--hairline-strong)] pb-4 text-center text-[10px] uppercase tracking-[0.22em] text-[var(--accent-deep)]">
                      Gold
                    </th>
                    <th className="border-b border-[var(--hairline-strong)] pb-4 text-center text-[10px] uppercase tracking-[0.22em] text-[var(--ink)]">
                      Platinum
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.label} className="group">
                      <td className="border-b border-[var(--hairline)] py-4 text-sm font-semibold text-[var(--ink)] group-last:border-0">
                        {row.label}
                      </td>
                      {(["bronze", "silver", "gold", "platinum"] as const).map((tier) => {
                        const val = row[tier];
                        return (
                          <td
                            key={tier}
                            className="border-b border-[var(--hairline)] py-4 text-center text-sm group-last:border-0"
                          >
                            {typeof val === "boolean" ? (
                              val ? (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-dim)] text-xs text-[var(--accent-deep)]">
                                  ✓
                                </span>
                              ) : (
                                <span className="text-[var(--ink-faint)]">—</span>
                              )
                            ) : (
                              <span className="tabular font-medium text-[var(--ink)]">{val}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-6 py-28 md:py-36">
        <Reveal>
          <div className="chip mb-5">Questions</div>
          <h2 className="font-display max-w-3xl text-5xl font-medium tracking-[-0.03em] md:text-6xl">
            Credit FAQ.
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
            Start building your
            <br />
            <span className="italic text-[var(--accent)]">credit today.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg text-white/70">
            Every on-time repayment is a step toward better rates, higher LTV, and exclusive access. Your reputation starts now.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-4 md:flex-row">
            <a href={TELEGRAM_URL} className="btn-accent text-lg">
              Launch on Telegram
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/tokens"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-[0.9rem] text-base font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
            >
              Browse approved tokens
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hairline)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div className="text-xs text-[var(--ink-soft)]">
              © {new Date().getFullYear()} Magpie · Built on Solana
            </div>
            <div className="text-xs text-[var(--ink-faint)]">
              Credit scores are on-chain and non-transferable. Not financial advice.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
