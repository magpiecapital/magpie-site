"use client";

/**
 * DemoPlayer — "See how Magpie works" walkthrough.
 *
 * A native, subtitled demo that looks and controls like a video (play/pause,
 * scrubber, captions) but renders as brand-matched DOM: crisp at every size,
 * ~zero payload, dark-mode for free, and never stale vs. the real product.
 *
 * Architecture: ONE master clock (ms into the demo). Every scene and caption
 * derives from `t`. That gives scrubbing on the site and lets the mp4
 * exporter drive frames deterministically via window.__demoSeek(t).
 * Sound-free by design — the captions ARE the narration.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/* ─── Script: scenes + captions (single source of truth) ─────────── */

export const DEMO_DURATION_MS = 82_000;

type Caption = { from: number; to: number; text: string };
export const CAPTIONS: Caption[] = [
  { from: 0, to: 5_500, text: "Magpie lets you borrow SOL against tokens you already hold — without selling them." },
  { from: 5_500, to: 12_000, text: "Start at magpie.capital and hit Dashboard. Everything lives in one place — borrowing, positions, and exits." },
  { from: 12_000, to: 21_000, text: "Pick your collateral. Three collateral classes, one protocol: memecoins, tokenized stocks & RWAs, and collectibles." },
  { from: 21_000, to: 31_500, text: "Choose how much to borrow. LTV, duration, and the fee are shown up front — no surprises, no margin calls on fixed terms." },
  { from: 31_500, to: 42_000, text: "Sign once. Your collateral locks in the on-chain vault, and SOL lands in your wallet — usually within seconds." },
  { from: 42_000, to: 54_000, text: "Track everything in Positions. We remind you before expiry, and /autoextend can renew the loan automatically." },
  { from: 54_000, to: 66_500, text: "Our flagship — V4 exit orders. Arm a stop-loss, take-profit, or a laddered exit. They fire inside the vault, so your loan stays active." },
  { from: 66_500, to: 75_000, text: "Repay any time to unlock your collateral. It returns to your wallet in the same transaction." },
  { from: 75_000, to: 82_000, text: "Collateral that can still sell itself. Start at magpie.capital — or earn yield on the other side at /earn." },
];

const SCENES = [
  { at: 0, label: "Intro" },
  { at: 5_500, label: "Open the Dashboard" },
  { at: 12_000, label: "Choose collateral" },
  { at: 21_000, label: "Set your loan" },
  { at: 31_500, label: "Sign & receive" },
  { at: 42_000, label: "Track & manage" },
  { at: 54_000, label: "V4 exit orders" },
  { at: 66_500, label: "Repay & reclaim" },
  { at: 75_000, label: "Done" },
];

/* ─── tiny timeline helpers ──────────────────────────────────────── */

/** 0→1 progress of t between a and b, clamped. */
function seg(t: number, a: number, b: number): number {
  if (t <= a) return 0;
  if (b <= a) return 1;
  return Math.min(1, (t - a) / (b - a));
}
const ease = (p: number) => 1 - Math.pow(1 - p, 3); // easeOutCubic

/** Fade/slide-in style for an element entering at `at`. */
function enter(t: number, at: number, dur = 450): React.CSSProperties {
  const p = ease(seg(t, at, at + dur));
  return { opacity: p, transform: `translateY(${(1 - p) * 14}px)` };
}

function sceneIndexAt(t: number): number {
  let idx = 0;
  for (let i = 0; i < SCENES.length; i++) if (t >= SCENES[i].at) idx = i;
  return idx;
}

/* ─── Scene chrome: a stylized app frame ─────────────────────────── */

function Frame({
  children,
  url = "magpie.capital/dashboard",
  nav,
}: {
  children: React.ReactNode;
  url?: string;
  nav?: "Overview" | "Borrow" | "Positions" | "Earn";
}) {
  const NAV_ITEMS: Array<{ label: "Overview" | "Borrow" | "Positions" | "Earn"; icon: string }> = [
    { label: "Overview", icon: "▦" },
    { label: "Borrow", icon: "↧" },
    { label: "Positions", icon: "◎" },
    { label: "Earn", icon: "✦" },
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center p-[3.5%]">
      <div className="relative h-full w-full max-w-[560px] overflow-hidden rounded-2xl border border-[var(--hairline-strong)] bg-[var(--bg)] shadow-xl">
        <div className="flex h-8 items-center gap-1.5 border-b border-[var(--hairline)] bg-[var(--bg-elevated)] px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--hairline-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--hairline-strong)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--hairline-strong)]" />
          <span className="mx-auto rounded-md bg-[var(--bg)] px-3 py-0.5 text-[10px] text-[var(--ink-faint)]">
            {url}
          </span>
        </div>
        <div className="flex h-[calc(100%-2rem)]">
          {nav && (
            <aside className="flex w-[86px] shrink-0 flex-col gap-0.5 border-r border-[var(--hairline)] bg-[var(--bg-elevated)] p-1.5 pt-2">
              {NAV_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium ${
                    item.label === nav
                      ? "bg-[var(--accent-dim)] text-[var(--ink)]"
                      : "text-[var(--ink-faint)]"
                  }`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </div>
              ))}
              <div className="mt-auto rounded-lg px-2 py-1.5 text-[9px] text-[var(--ink-faint)]">
                7xF2…9kQd
              </div>
            </aside>
          )}
          <div className="relative flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-2 py-2 text-left text-[11px] font-medium whitespace-nowrap transition-colors ${
        active
          ? "border-[var(--accent-deep)] bg-[var(--accent-dim)] text-[var(--ink)]"
          : "border-[var(--hairline)] bg-[var(--bg-elevated)] text-[var(--ink-soft)]"
      }`}
    >
      {children}
    </div>
  );
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--ink-faint)]">{k}</span>
      <span className={strong ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-soft)]"}>{v}</span>
    </div>
  );
}

/* ─── Scenes ─────────────────────────────────────────────────────── */

function SceneIntro({ t }: { t: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
      <div style={enter(t, 300)} className="font-display text-3xl tracking-[-0.03em] sm:text-4xl">
        Keep the upside.
        <br />
        <span className="italic">Spend the SOL.</span>
      </div>
      <div style={enter(t, 1_400)} className="max-w-xs text-sm text-[var(--ink-soft)]">
        Borrow against your bag without selling it — in about a minute.
      </div>
    </div>
  );
}

function SceneNavigate({ t }: { t: number }) {
  const local = t - 5_500;
  const clicked = local > 3_600;
  // cursor glides from lower-left toward the Dashboard button
  const p = ease(seg(local, 800, 3_400));
  const cx = 18 + p * 66; // percent
  const cy = 72 - p * 58;
  return (
    <Frame url={clicked ? "magpie.capital/dashboard" : "magpie.capital"}>
      <div className="relative flex h-full flex-col p-4">
        {/* mini homepage header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight">magpie</span>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
              clicked
                ? "bg-[var(--accent)] text-[var(--accent-ink)] ring-2 ring-[var(--accent-deep)]"
                : "bg-[var(--accent)] text-[var(--accent-ink)]"
            }`}
          >
            Dashboard →
          </span>
        </div>
        {!clicked ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-2">
            <div style={enter(local, 300)} className="font-display text-xl tracking-[-0.03em]">
              Liquidity without <span className="italic">selling your bag.</span>
            </div>
            <div style={enter(local, 900)} className="text-[11px] text-[var(--ink-soft)]">
              magpie.capital — then one click to your dashboard.
            </div>
          </div>
        ) : (
          <div style={enter(local, 3_700, 350)} className="flex flex-1 flex-col justify-center gap-2">
            <div className="text-sm font-semibold">Dashboard</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-2 text-center">
                <div className="text-sm font-semibold">0</div>
                <div className="text-[9px] text-[var(--ink-faint)]">Active loans</div>
              </div>
              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-2 text-center">
                <div className="text-sm font-semibold">59.5</div>
                <div className="text-[9px] text-[var(--ink-faint)]">SOL collateral value</div>
              </div>
              <div className="rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-2 text-center">
                <div className="text-sm font-semibold">—</div>
                <div className="text-[9px] text-[var(--ink-faint)]">Exit orders</div>
              </div>
            </div>
            <div className="text-center text-[10px] text-[var(--accent-deep)]">
              Ready to borrow — let&apos;s go ↓
            </div>
          </div>
        )}
        {/* cursor */}
        {!clicked && (
          <div
            className="pointer-events-none absolute z-10 text-base"
            style={{ left: `${cx}%`, top: `${cy}%` }}
            aria-hidden
          >
            <span className="drop-shadow">↖</span>
          </div>
        )}
      </div>
    </Frame>
  );
}

function SceneChoose({ t }: { t: number }) {
  const local = t - 12_000;
  const picked = local > 5_200;
  return (
    <Frame nav="Borrow">
      <div className="flex h-full flex-col justify-center gap-3 p-4 pb-8">
        <div style={enter(local, 200)} className="text-sm font-semibold">
          Marketplace — three collateral classes
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div style={enter(local, 700)}>
            <Chip active={picked}>
              🪙 Memecoins
              <div className="mt-1 text-[10px] text-[var(--ink-faint)]">WIF · BONK · 200+</div>
            </Chip>
          </div>
          <div style={enter(local, 1_100)}>
            <Chip>
              📈 Stocks & RWAs
              <div className="mt-1 text-[10px] text-[var(--ink-faint)]">TSLAx · GLDx · 25</div>
            </Chip>
          </div>
          <div style={enter(local, 1_500)}>
            <Chip>
              🃏 Collectibles
              <div className="mt-1 text-[10px] text-[var(--ink-faint)]">$CARDS · graded</div>
            </Chip>
          </div>
        </div>
        <div style={enter(local, 2_600)} className="rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">Your wallet</div>
            <div className="text-[10px] text-[var(--ink-faint)]">connected</div>
          </div>
          <div className="mt-2 space-y-1.5">
            <div
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${
                picked ? "bg-[var(--accent-dim)]" : ""
              }`}
            >
              <span>🪙 WIF — 4,200 tokens</span>
              <span className="text-[var(--ink-faint)]">≈ 38.5 SOL</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs">
              <span>📈 GLDx — 1.2 tokens</span>
              <span className="text-[var(--ink-faint)]">≈ 21.0 SOL</span>
            </div>
          </div>
        </div>
        {picked && (
          <div style={enter(local, 5_200, 300)} className="text-center text-[11px] text-[var(--accent-deep)]">
            ✓ WIF selected as collateral
          </div>
        )}
      </div>
    </Frame>
  );
}

function SceneTerms({ t }: { t: number }) {
  const local = t - 21_000;
  const slide = ease(seg(local, 1_200, 5_000)); // amount slider filling
  const amount = (3 + slide * 4.7).toFixed(1); // 3 → 7.7 SOL
  return (
    <Frame nav="Borrow">
      <div className="flex h-full flex-col justify-center gap-2.5 p-4 pb-8">
        <div style={enter(local, 200)} className="text-sm font-semibold">
          Set your loan — WIF collateral
        </div>
        <div style={enter(local, 600)} className="rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-3">
          <Row k="Borrow amount" v={`${amount} SOL`} strong />
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--hairline)]">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${20 + slide * 57}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2" style={enter(local, 1_800)}>
          <Chip active>
            Standard
            <div className="mt-0.5 text-[10px] text-[var(--ink-faint)]">20% LTV · 1.5% fee</div>
          </Chip>
          <Chip>
            Quick
            <div className="mt-0.5 text-[10px] text-[var(--ink-faint)]">25% LTV · 2% fee</div>
          </Chip>
          <Chip>
            Express
            <div className="mt-0.5 text-[10px] text-[var(--ink-faint)]">30% LTV · 3% fee</div>
          </Chip>
        </div>
        <div style={enter(local, 3_000)} className="rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-3">
          <div className="space-y-1.5">
            <Row k="Duration" v="7 days — fixed term, due date shown up front" />
            <Row k="Margin calls" v="none on fixed terms" strong />
          </div>
        </div>
      </div>
    </Frame>
  );
}

function SceneSign({ t }: { t: number }) {
  const local = t - 31_500;
  const signed = local > 3_800;
  const landed = local > 6_400;
  return (
    <Frame nav="Borrow">
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        {!signed && (
          <div style={enter(local, 400)} className="w-full max-w-[300px] rounded-xl border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] p-4 text-center shadow-md">
            <div className="text-xs font-semibold">Wallet — approve transaction</div>
            <div className="mt-2 space-y-1 text-left">
              <Row k="Lock collateral" v="4,200 WIF" />
              <Row k="Receive" v="7.7 SOL" strong />
            </div>
            <div className="mt-3 rounded-lg bg-[var(--accent)] py-1.5 text-xs font-semibold text-[var(--accent-ink)]">
              {local > 2_600 ? "Signing…" : "Approve"}
            </div>
          </div>
        )}
        {signed && (
          <>
            <div style={enter(local, 3_800, 300)} className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs text-[var(--accent-ink)]">✓</span>
              Collateral locked in the on-chain vault
            </div>
            {landed && (
              <div style={enter(local, 6_400, 300)} className="rounded-xl border border-[var(--accent-deep)] bg-[var(--accent-dim)] px-5 py-3 text-center">
                <div className="text-lg font-semibold">+7.7 SOL</div>
                <div className="text-[10px] text-[var(--ink-soft)]">landed in your wallet</div>
              </div>
            )}
          </>
        )}
      </div>
    </Frame>
  );
}

function SceneTrack({ t }: { t: number }) {
  const local = t - 42_000;
  const dm = local > 5_000;
  return (
    <Frame nav="Positions">
      <div className="flex h-full flex-col justify-center gap-3 p-4">
        <div style={enter(local, 200)} className="text-sm font-semibold">
          Your loan dashboard
        </div>
        <div style={enter(local, 700)} className="rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-3">
          <div className="space-y-1.5">
            <Row k="Loan #1042" v="Active" strong />
            <Row k="Owed" v="7.82 SOL" />
            <Row k="Due" v="in 6d 22h" />
            <Row k="Collateral" v="4,200 WIF — in vault" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px] font-semibold">
            <div className="rounded-lg border border-[var(--hairline)] py-1.5">Repay</div>
            <div className="rounded-lg border border-[var(--hairline)] py-1.5">Extend</div>
            <div className="rounded-lg border border-[var(--hairline)] py-1.5">Top up</div>
          </div>
        </div>
        {dm && (
          <div style={enter(local, 5_000, 350)} className="rounded-xl border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] p-3 shadow-md">
            <div className="text-[10px] font-semibold text-[var(--ink-faint)]">TELEGRAM · @magpie</div>
            <div className="mt-1 text-xs">
              ⚠️ <b>Loan due in ~24h.</b> Repay or extend — or turn on <b>/autoextend</b> and we&apos;ll renew it for you automatically.
            </div>
          </div>
        )}
      </div>
    </Frame>
  );
}

function SceneV4({ t }: { t: number }) {
  const local = t - 54_000;
  const armed = local > 6_500;
  return (
    <Frame nav="Positions">
      <div className="flex h-full flex-col justify-start gap-1.5 p-3 pt-2 pb-12">
        <div style={enter(local, 200)} className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Protect the position — exit orders</span>
          <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--accent-ink)]">
            V4 flagship
          </span>
        </div>
        <div style={enter(local, 900)} className="rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-2.5 py-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">🛑 Stop-loss</span>
            <span className="text-[var(--ink-soft)]">price −25% → sell enough to cover the loan</span>
          </div>
        </div>
        <div style={enter(local, 2_100)} className="rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-2.5 py-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">🎯 Take-profit</span>
            <span className="text-[var(--ink-soft)]">price +40% → sell 50%, bank the gain</span>
          </div>
        </div>
        <div style={enter(local, 3_300)} className="rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-2.5 py-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold">🪜 Ladder</span>
            <span className="text-[var(--ink-soft)]">25% @ +20% · 25% @ +40% · 50% @ +80%</span>
          </div>
          <div className="mt-1.5 flex gap-1">
            <div className="h-1.5 flex-1 rounded-full bg-[var(--accent-dim)]" />
            <div className="h-1.5 flex-1 rounded-full bg-[var(--accent)]" />
            <div className="h-1.5 flex-[2] rounded-full bg-[var(--accent-deep)]" />
          </div>
        </div>
        {armed && (
          <div style={enter(local, 6_500, 350)} className="rounded-xl border border-[var(--accent-deep)] bg-[var(--accent-dim)] px-2.5 py-2 text-center text-[11px]">
            <span className="font-semibold">✓ Armed — orders fire in-vault.</span> Loan stays <b>Active</b> · no margin calls.
          </div>
        )}
      </div>
    </Frame>
  );
}

function SceneRepay({ t }: { t: number }) {
  const local = t - 66_500;
  const done = local > 3_600;
  return (
    <Frame nav="Positions">
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
        {!done && (
          <div style={enter(local, 300)} className="w-full max-w-[300px] rounded-xl border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] p-4 text-center shadow-md">
            <div className="text-xs font-semibold">Repay loan #1042</div>
            <div className="mt-2 space-y-1 text-left">
              <Row k="Repay" v="7.82 SOL" />
              <Row k="Unlock" v="4,200 WIF" strong />
            </div>
            <div className="mt-3 rounded-lg bg-[var(--accent)] py-1.5 text-xs font-semibold text-[var(--accent-ink)]">
              {local > 2_200 ? "Repaying…" : "Repay & unlock"}
            </div>
          </div>
        )}
        {done && (
          <>
            <div style={enter(local, 3_600, 300)} className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs text-[var(--accent-ink)]">✓</span>
              Loan repaid — vault unlocked
            </div>
            <div style={enter(local, 4_600, 300)} className="rounded-xl border border-[var(--accent-deep)] bg-[var(--accent-dim)] px-5 py-3 text-center">
              <div className="text-lg font-semibold">4,200 WIF</div>
              <div className="text-[10px] text-[var(--ink-soft)]">back in your wallet — upside intact</div>
            </div>
          </>
        )}
      </div>
    </Frame>
  );
}

function SceneOutro({ t }: { t: number }) {
  const local = t - 75_000;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
      <div style={enter(local, 300)} className="font-display text-2xl tracking-[-0.03em] sm:text-3xl">
        Collateral that can
        <br />
        <span className="italic">still sell itself.</span>
      </div>
      <div style={enter(local, 1_500)} className="text-sm text-[var(--ink-soft)]">
        Borrow at <span className="font-semibold text-[var(--ink)]">magpie.capital</span> · Earn at{" "}
        <span className="font-semibold text-[var(--ink)]">/earn</span>
      </div>
      <div style={enter(local, 2_400)} className="rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-deep)]">
        Three collateral classes · one protocol
      </div>
    </div>
  );
}

function Scenes({ t }: { t: number }) {
  const idx = sceneIndexAt(t);
  return (
    <>
      {idx === 0 && <SceneIntro t={t} />}
      {idx === 1 && <SceneNavigate t={t} />}
      {idx === 2 && <SceneChoose t={t} />}
      {idx === 3 && <SceneTerms t={t} />}
      {idx === 4 && <SceneSign t={t} />}
      {idx === 5 && <SceneTrack t={t} />}
      {idx === 6 && <SceneV4 t={t} />}
      {idx === 7 && <SceneRepay t={t} />}
      {idx === 8 && <SceneOutro t={t} />}
    </>
  );
}

/* ─── Player shell ───────────────────────────────────────────────── */

declare global {
  interface Window {
    __demoSeek?: (t: number) => void;
  }
}

export function DemoPlayer({ exportMode = false }: { exportMode?: boolean }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);
  const barRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // Scenes are composed at a fixed 560x315 design size and scaled to the
  // stage, so mobile shows the exact same composition instead of cropping.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 560));
    ro.observe(el);
    setScale(el.clientWidth / 560);
    return () => ro.disconnect();
  }, []);

  // Deterministic-seek hook — used by the mp4 renderer and by the visual
  // regression screenshots. Harmless in production (inert unless called).
  useEffect(() => {
    window.__demoSeek = (ms: number) => { setStarted(true); setT(Math.max(0, Math.min(DEMO_DURATION_MS, ms))); };
    return () => {
      delete window.__demoSeek;
    };
  }, []);

  const tick = useCallback((now: number) => {
    const dt = now - last.current;
    last.current = now;
    setT((prev) => {
      const next = prev + dt;
      if (next >= DEMO_DURATION_MS) {
        setPlaying(false);
        return DEMO_DURATION_MS;
      }
      return next;
    });
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!playing || exportMode) return;
    last.current = performance.now();
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [playing, exportMode, tick]);

  const toggle = () => {
    setStarted(true);
    if (t >= DEMO_DURATION_MS) setT(0);
    setPlaying((p) => !p);
  };

  const seekFromPointer = (clientX: number) => {
    const el = barRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setStarted(true);
    setT(p * DEMO_DURATION_MS);
  };

  const caption = CAPTIONS.find((c) => t >= c.from && t < c.to) ?? CAPTIONS[CAPTIONS.length - 1];
  const progress = t / DEMO_DURATION_MS;
  const sceneIdx = sceneIndexAt(t);

  return (
    <div
      className="group relative w-full overflow-hidden rounded-3xl border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] shadow-lg"
      role="region"
      aria-label="How Magpie works — interactive walkthrough with captions"
    >
      {/* Stage — 16:9; scenes render in a 560x315 design box scaled to fit */}
      <div ref={stageRef} className="relative aspect-video select-none overflow-hidden bg-[var(--bg)]">
        <div
          className="relative"
          style={{ width: 560, height: 315, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <Scenes t={t} />
        </div>

        {/* Captions (the narration) — overlay on larger screens only; on
            mobile the 16:9 stage is too short to share with 3 lines of text,
            so the caption renders as its own strip below the stage. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden justify-center p-3 sm:flex sm:p-4">
          <div
            aria-live="polite"
            className="max-w-[92%] rounded-xl bg-[color-mix(in_srgb,var(--ink)88%,transparent)] px-3 py-2 text-center text-sm leading-snug text-[var(--bg)]"
          >
            {caption.text}
          </div>
        </div>

        {/* Poster / big play (before first start) */}
        {!started && !exportMode && (
          <button
            onClick={toggle}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[color-mix(in_srgb,var(--bg)55%,transparent)] backdrop-blur-[2px]"
            aria-label="Play the walkthrough"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-2xl text-[var(--accent-ink)] shadow-lg transition-transform group-hover:scale-105">
              ▶
            </span>
            <span className="text-sm font-semibold">See how Magpie works — 60 seconds, captioned</span>
          </button>
        )}
      </div>

      {/* Mobile caption strip (overlay is sm+ only) */}
      <div className="border-t border-[var(--hairline)] px-3 py-2 text-center text-[12px] leading-snug text-[var(--ink)] sm:hidden" aria-hidden>
        {caption.text}
      </div>

      {/* Controls */}
      {!exportMode && (
        <div className="flex items-center gap-3 border-t border-[var(--hairline)] px-3 py-2.5 sm:px-4">
          <button
            onClick={toggle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm text-[var(--accent-ink)]"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <div
            ref={barRef}
            className="relative h-6 flex-1 cursor-pointer"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              seekFromPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) seekFromPointer(e.clientX);
            }}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setT((v) => Math.min(DEMO_DURATION_MS, v + 2_000));
              if (e.key === "ArrowLeft") setT((v) => Math.max(0, v - 2_000));
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                toggle();
              }
            }}
          >
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--hairline)]">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress * 100}%` }} />
            </div>
            {/* scene markers */}
            {SCENES.map((s) => (
              <span
                key={s.at}
                className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-[var(--hairline-strong)]"
                style={{ left: `${(s.at / DEMO_DURATION_MS) * 100}%` }}
              />
            ))}
          </div>
          <div className="hidden shrink-0 text-[11px] tabular-nums text-[var(--ink-faint)] sm:block">
            {Math.floor(t / 1000)}s · {SCENES[sceneIdx].label}
          </div>
        </div>
      )}
    </div>
  );
}
