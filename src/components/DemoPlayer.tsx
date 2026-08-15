"use client";

/**
 * DemoPlayer — "See how Magpie works" walkthrough (v3).
 *
 * A native, subtitled demo that looks and controls like a video (play/pause,
 * scrubber, captions) but renders as brand-matched DOM: crisp at every size,
 * ~zero payload, dark-mode for free, and never stale vs. the real product.
 *
 * v3 (operator quality bar): scenes REPLICATE the real /dashboard — the
 * actual sidebar (Overview/Loans/Credit/Points/Holdings/Activity/Governance),
 * top bar with wallet pill + Open Bot, serif section headings, stat-card row,
 * dashed empty-states — plus a Telegram-bot scene (the other rail) and a
 * homepage→Dashboard wayfinding scene. No overlapping text anywhere: every
 * scene reserves CAPTION_CLEAR_PX at the bottom of the design box.
 *
 * Architecture: ONE master clock (ms). Every scene + caption derives from `t`
 * → scrubbing on-site and deterministic mp4 export via window.__demoSeek(t).
 */

import { useCallback, useEffect, useRef, useState } from "react";

/* ─── Script: scenes + captions (single source of truth) ─────────── */

export const DEMO_DURATION_MS = 95_500;

type Caption = { from: number; to: number; text: string };
export const CAPTIONS: Caption[] = [
  { from: 0, to: 5_500, text: "Magpie lets you borrow SOL against tokens you already hold — without selling them." },
  { from: 5_500, to: 12_000, text: "Start at magpie.capital and hit Dashboard. Everything lives in one place." },
  { from: 12_000, to: 20_000, text: "Connect your wallet and the dashboard comes alive — balances, eligible collateral, loans, and your credit score." },
  { from: 20_000, to: 29_000, text: "Pick your collateral. Three collateral classes, one protocol: memecoins, tokenized stocks & RWAs, and collectibles." },
  { from: 29_000, to: 39_000, text: "Choose how much to borrow. LTV, duration, and the fee are shown up front — no surprises, no margin calls on fixed terms." },
  { from: 39_000, to: 48_500, text: "Sign once. Your collateral locks in the on-chain vault, and SOL lands in your wallet — usually within seconds." },
  { from: 48_500, to: 59_000, text: "Your loan lives under Loans. We remind you before expiry, and /autoextend can renew it automatically." },
  { from: 59_000, to: 71_000, text: "Our flagship — V4 exit orders. Arm a stop-loss, take-profit, or a laddered exit. They fire inside the vault, so your loan stays active." },
  { from: 71_000, to: 81_000, text: "Prefer chat? The Telegram bot does everything the dashboard does — borrow, extend, repay — right from your phone." },
  { from: 81_000, to: 88_500, text: "Repay any time to unlock your collateral. It returns to your wallet in the same transaction." },
  { from: 88_500, to: 95_500, text: "Collateral that can still sell itself. Start at magpie.capital — or earn yield on the other side at /earn." },
];

const SCENES = [
  { at: 0, label: "Intro" },
  { at: 5_500, label: "Open the Dashboard" },
  { at: 12_000, label: "Your dashboard" },
  { at: 20_000, label: "Choose collateral" },
  { at: 29_000, label: "Set your loan" },
  { at: 39_000, label: "Sign & receive" },
  { at: 48_500, label: "Track & manage" },
  { at: 59_000, label: "V4 exit orders" },
  { at: 71_000, label: "Telegram bot" },
  { at: 81_000, label: "Repay & reclaim" },
  { at: 88_500, label: "Done" },
];

/* ─── timeline helpers ───────────────────────────────────────────── */

function seg(t: number, a: number, b: number): number {
  if (t <= a) return 0;
  if (b <= a) return 1;
  return Math.min(1, (t - a) / (b - a));
}
const ease = (p: number) => 1 - Math.pow(1 - p, 3);

function enter(t: number, at: number, dur = 450): React.CSSProperties {
  const p = ease(seg(t, at, at + dur));
  return { opacity: p, transform: `translateY(${(1 - p) * 12}px)` };
}

function sceneIndexAt(t: number): number {
  let idx = 0;
  for (let i = 0; i < SCENES.length; i++) if (t >= SCENES[i].at) idx = i;
  return idx;
}

/* ─── Design constants ───────────────────────────────────────────── */
// Scenes compose at a fixed design size and scale to the stage. The bottom
// CAPTION_CLEAR_PX of the box is a no-content zone so the caption overlay can
// never collide with scene content (the v2 defect).
const DESIGN_W = 560;
const DESIGN_H = 315;
const CAPTION_CLEAR_PX = 46;

/* ─── Real-dashboard chrome (mirrors src/app/dashboard layout) ───── */

const SIDEBAR_ITEMS = ["Overview", "Loans", "Credit", "Points", "Holdings", "Activity", "Governance"] as const;
type SidebarItem = (typeof SIDEBAR_ITEMS)[number];

function DashFrame({
  children,
  active,
  url = "magpie.capital/dashboard",
  wallet = "7xF2…9kQd",
}: {
  children: React.ReactNode;
  active: SidebarItem;
  url?: string;
  wallet?: string | null;
}) {
  return (
    <div className="absolute inset-0 flex items-start justify-center px-[3%] pt-[2.5%]" style={{ paddingBottom: CAPTION_CLEAR_PX }}>
      <div className="flex h-full w-full max-w-[532px] flex-col overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface,var(--bg))] shadow-xl">
        {/* browser bar */}
        <div className="flex h-6 shrink-0 items-center gap-1 border-b border-[var(--hairline)] bg-[var(--bg-elevated)] px-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--hairline-strong)]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--hairline-strong)]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--hairline-strong)]" />
          <span className="mx-auto rounded bg-[var(--bg)] px-2 py-px text-[8px] text-[var(--ink-faint)]">{url}</span>
        </div>
        {/* app top bar — mirrors the real dashboard header */}
        <div className="flex h-7 shrink-0 items-center justify-between border-b border-[var(--hairline)] bg-[var(--bg-elevated)] px-2">
          <span className="rounded-full bg-[var(--bg)] px-2 py-px text-[8px] text-[var(--ink-soft)]">
            {wallet ? `● ${wallet}` : "○ No wallet connected"}
          </span>
          <span className="flex items-center gap-1">
            <span className="rounded-full border border-[var(--hairline)] px-1.5 py-px text-[8px] text-[var(--ink-soft)]">Customize</span>
            <span className="rounded-full bg-[var(--ink)] px-1.5 py-px text-[8px] font-semibold text-[var(--bg)]">✈ Open Bot</span>
          </span>
        </div>
        <div className="flex min-h-0 flex-1">
          {/* sidebar — the real nav */}
          <aside className="w-[92px] shrink-0 border-r border-[var(--hairline)] bg-[var(--bg-elevated)] px-1.5 pt-1.5">
            {SIDEBAR_ITEMS.map((item) => (
              <div
                key={item}
                className={`mb-0.5 rounded-md px-2 py-[3px] text-[9px] font-medium ${
                  item === active ? "bg-[var(--accent-dim)] text-[var(--ink)]" : "text-[var(--ink-soft)]"
                }`}
              >
                {item}
              </div>
            ))}
            <div className="mt-1.5 px-2 text-[7px] uppercase tracking-wider text-[var(--ink-faint)]">Links</div>
            <div className="px-2 pt-0.5 text-[8px] leading-relaxed text-[var(--ink-faint)]">
              Tokens<br />Docs · Stats
            </div>
          </aside>
          <div className="relative min-w-0 flex-1 overflow-hidden p-2.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, hi = false }: { label: string; value: string; sub?: string; hi?: boolean }) {
  return (
    <div className={`rounded-lg border p-1.5 ${hi ? "border-[var(--accent-deep)] bg-[var(--accent-dim)]" : "border-[var(--hairline)] bg-[var(--bg-elevated)]"}`}>
      <div className="text-[7px] uppercase tracking-wider text-[var(--ink-faint)]">{label}</div>
      <div className="font-display text-[13px] leading-tight">{value}</div>
      {sub && <div className="text-[7px] text-[var(--ink-faint)]">{sub}</div>}
    </div>
  );
}

function SectionHead({ children, count }: { children: React.ReactNode; count?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-display text-[12px] font-medium">{children}</span>
      {count != null && <span className="rounded-full bg-[var(--bg-elevated)] px-1 text-[8px] text-[var(--ink-faint)]">{count}</span>}
    </div>
  );
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[10px] leading-snug">
      <span className="shrink-0 text-[var(--ink-faint)]">{k}</span>
      <span className={`text-right ${strong ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-soft)]"}`}>{v}</span>
    </div>
  );
}

/* ─── Scenes ─────────────────────────────────────────────────────── */

function SceneIntro({ t }: { t: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 pb-8 text-center">
      <div style={enter(t, 300)} className="font-display text-3xl tracking-[-0.03em]">
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
  const p = ease(seg(local, 800, 3_400));
  const cx = 20 + p * 60;
  const cy = 66 - p * 50;
  return (
    <div className="absolute inset-0 flex items-start justify-center px-[3%] pt-[2.5%]" style={{ paddingBottom: CAPTION_CLEAR_PX }}>
      <div className="relative flex h-full w-full max-w-[532px] flex-col overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-[var(--bg)] shadow-xl">
        <div className="flex h-6 shrink-0 items-center gap-1 border-b border-[var(--hairline)] bg-[var(--bg-elevated)] px-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--hairline-strong)]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--hairline-strong)]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--hairline-strong)]" />
          <span className="mx-auto rounded bg-[var(--bg)] px-2 py-px text-[8px] text-[var(--ink-faint)]">
            {clicked ? "magpie.capital/dashboard" : "magpie.capital"}
          </span>
        </div>
        {/* real-site header: wordmark + nav + CTA */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[12px] font-semibold tracking-tight">🐦 magpie</span>
          <span className="flex items-center gap-2 text-[9px] text-[var(--ink-soft)]">
            <span>Stats</span>
            <span>Docs</span>
            <span
              className={`rounded-full bg-[var(--accent)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent-ink)] ${
                clicked ? "ring-2 ring-[var(--accent-deep)]" : ""
              }`}
            >
              Dashboard →
            </span>
          </span>
        </div>
        {!clicked ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-1.5 px-4 pb-4">
            <div style={enter(local, 300)} className="font-display text-lg tracking-[-0.03em]">
              Liquidity without <span className="italic">selling your bag.</span>
            </div>
            <div style={enter(local, 900)} className="text-[10px] text-[var(--ink-soft)]">
              Borrow SOL against memecoins, tokenized stocks, and collectibles.
            </div>
          </div>
        ) : (
          <div style={enter(local, 3_700, 350)} className="flex flex-1 flex-col justify-center gap-1.5 px-3 pb-3">
            <div className="grid grid-cols-3 gap-1.5">
              <StatCard label="SOL Balance" value="12.4" sub="SOL" />
              <StatCard label="Eligible collateral" value="2" sub="tokens" />
              <StatCard label="Active loans" value="0" sub="ready to borrow" hi />
            </div>
            <div className="text-center text-[9px] text-[var(--accent-deep)]">Your dashboard — let&apos;s borrow ↓</div>
          </div>
        )}
        {!clicked && (
          <div className="pointer-events-none absolute z-10" style={{ left: `${cx}%`, top: `${cy}%` }} aria-hidden>
            <span className="text-sm drop-shadow">↖</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SceneOverview({ t }: { t: number }) {
  const local = t - 12_000;
  return (
    <DashFrame active="Overview">
      <div className="flex h-full flex-col gap-2">
        <div style={enter(local, 200)} className="grid grid-cols-4 gap-1.5">
          <StatCard label="SOL Balance" value="12.4" sub="SOL" />
          <StatCard label="Holdings" value="2" sub="SPL tokens" />
          <StatCard label="Eligible" value="2" sub="collateral" />
          <StatCard label="Credit score" value="640" sub="Silver tier" />
        </div>
        <div style={enter(local, 1_200)}>
          <SectionHead count="2">Eligible Collateral</SectionHead>
          <div className="mt-1 rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] p-2">
            <Row k="🪙 WIF — 4,200 tokens" v="≈ 38.5 SOL" />
            <div className="mt-1 border-t border-[var(--hairline)] pt-1">
              <Row k="📈 GLDx — 1.2 tokens" v="≈ 21.0 SOL" />
            </div>
          </div>
        </div>
        <div style={enter(local, 2_400)}>
          <SectionHead count="0">Active Loans</SectionHead>
          <div className="mt-1 rounded-lg border border-dashed border-[var(--hairline-strong)] p-2 text-center text-[9px] text-[var(--ink-faint)]">
            No active loans — pick a token above to borrow against it
          </div>
        </div>
      </div>
    </DashFrame>
  );
}

function SceneChoose({ t }: { t: number }) {
  const local = t - 20_000;
  const picked = local > 4_800;
  return (
    <DashFrame active="Loans">
      <div className="flex h-full flex-col gap-2">
        <div style={enter(local, 200)}>
          <SectionHead>New loan — choose collateral</SectionHead>
        </div>
        <div style={enter(local, 800)} className="grid grid-cols-3 gap-1.5 text-[9px]">
          <div className={`rounded-lg border p-1.5 ${picked ? "border-[var(--accent-deep)] bg-[var(--accent-dim)]" : "border-[var(--hairline)] bg-[var(--bg-elevated)]"}`}>
            <div className="font-semibold">🪙 Memecoins</div>
            <div className="text-[8px] text-[var(--ink-faint)]">WIF · BONK · 200+</div>
          </div>
          <div className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] p-1.5">
            <div className="font-semibold">📈 Stocks · RWAs</div>
            <div className="text-[8px] text-[var(--ink-faint)]">TSLAx · GLDx · 25</div>
          </div>
          <div className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] p-1.5">
            <div className="font-semibold">🃏 Collectibles</div>
            <div className="text-[8px] text-[var(--ink-faint)]">$CARDS · graded</div>
          </div>
        </div>
        <div style={enter(local, 1_900)} className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] p-2">
          <div className="mb-1 text-[9px] font-semibold">Your wallet</div>
          <div className={`rounded-md px-1.5 py-1 ${picked ? "bg-[var(--accent-dim)]" : ""}`}>
            <Row k="🪙 WIF — 4,200 tokens" v="≈ 38.5 SOL" strong={picked} />
          </div>
          <div className="px-1.5 py-1">
            <Row k="📈 GLDx — 1.2 tokens" v="≈ 21.0 SOL" />
          </div>
        </div>
        {picked && (
          <div style={enter(local, 4_800, 300)} className="text-center text-[9px] font-medium text-[var(--accent-deep)]">
            ✓ WIF selected as collateral
          </div>
        )}
      </div>
    </DashFrame>
  );
}

function SceneTerms({ t }: { t: number }) {
  const local = t - 29_000;
  const slide = ease(seg(local, 1_200, 5_000));
  const amount = (3 + slide * 4.7).toFixed(1);
  return (
    <DashFrame active="Loans">
      <div className="flex h-full flex-col gap-2">
        <div style={enter(local, 200)}>
          <SectionHead>New loan — WIF collateral</SectionHead>
        </div>
        <div style={enter(local, 700)} className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] p-2">
          <Row k="Borrow amount" v={`${amount} SOL`} strong />
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--hairline)]">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${20 + slide * 57}%` }} />
          </div>
        </div>
        <div style={enter(local, 1_800)} className="grid grid-cols-3 gap-1.5 text-[9px]">
          <div className="rounded-lg border border-[var(--accent-deep)] bg-[var(--accent-dim)] p-1.5">
            <div className="font-semibold">Standard</div>
            <div className="text-[8px] text-[var(--ink-soft)]">20% LTV · 1.5% fee</div>
          </div>
          <div className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] p-1.5">
            <div className="font-semibold">Quick</div>
            <div className="text-[8px] text-[var(--ink-soft)]">25% LTV · 2% fee</div>
          </div>
          <div className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] p-1.5">
            <div className="font-semibold">Express</div>
            <div className="text-[8px] text-[var(--ink-soft)]">30% LTV · 3% fee</div>
          </div>
        </div>
        <div style={enter(local, 3_000)} className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] p-2">
          <Row k="Duration" v="7 days — fixed term, due date shown up front" />
          <div className="mt-1 border-t border-[var(--hairline)] pt-1">
            <Row k="Margin calls" v="none on fixed terms" strong />
          </div>
        </div>
      </div>
    </DashFrame>
  );
}

function SceneSign({ t }: { t: number }) {
  const local = t - 39_000;
  const signed = local > 3_600;
  const landed = local > 6_000;
  return (
    <DashFrame active="Loans">
      <div className="flex h-full flex-col items-center justify-center gap-2 pb-2">
        {!signed && (
          <div style={enter(local, 400)} className="w-full max-w-[240px] rounded-lg border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] p-2.5 text-center shadow-md">
            <div className="text-[10px] font-semibold">Wallet — approve transaction</div>
            <div className="mt-1.5 space-y-1 text-left">
              <Row k="Lock collateral" v="4,200 WIF" />
              <Row k="Receive" v="7.7 SOL" strong />
            </div>
            <div className="mt-2 rounded-md bg-[var(--accent)] py-1 text-[10px] font-semibold text-[var(--accent-ink)]">
              {local > 2_400 ? "Signing…" : "Approve"}
            </div>
          </div>
        )}
        {signed && (
          <>
            <div style={enter(local, 3_600, 300)} className="flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] text-[var(--accent-ink)]">✓</span>
              Collateral locked in the on-chain vault
            </div>
            {landed && (
              <div style={enter(local, 6_000, 300)} className="rounded-lg border border-[var(--accent-deep)] bg-[var(--accent-dim)] px-4 py-2 text-center">
                <div className="font-display text-base font-semibold">+7.7 SOL</div>
                <div className="text-[8px] text-[var(--ink-soft)]">landed in your wallet</div>
              </div>
            )}
          </>
        )}
      </div>
    </DashFrame>
  );
}

function SceneTrack({ t }: { t: number }) {
  const local = t - 48_500;
  const dm = local > 4_500;
  return (
    <DashFrame active="Loans">
      <div className="flex h-full flex-col gap-2">
        <div style={enter(local, 200)}>
          <SectionHead count="1">Active Loans</SectionHead>
        </div>
        <div style={enter(local, 700)} className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] p-2">
          <Row k="Loan #1042" v="Active" strong />
          <div className="mt-1 space-y-1 border-t border-[var(--hairline)] pt-1">
            <Row k="Owed" v="7.82 SOL" />
            <Row k="Due" v="in 6d 22h" />
            <Row k="Collateral" v="4,200 WIF — in vault" />
          </div>
          <div className="mt-1.5 grid grid-cols-3 gap-1 text-center text-[9px] font-semibold">
            <div className="rounded-md border border-[var(--hairline)] py-1">Repay</div>
            <div className="rounded-md border border-[var(--hairline)] py-1">Extend</div>
            <div className="rounded-md border border-[var(--hairline)] py-1">Top up</div>
          </div>
        </div>
        {dm && (
          <div style={enter(local, 4_500, 350)} className="rounded-lg border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] p-2 shadow-md">
            <div className="text-[8px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Telegram · Magpie</div>
            <div className="mt-0.5 text-[9px] leading-snug">
              ⚠️ <b>Loan due in ~24h.</b> Repay or extend — or turn on <b>/autoextend</b> and we&apos;ll renew it automatically.
            </div>
          </div>
        )}
      </div>
    </DashFrame>
  );
}

function SceneV4({ t }: { t: number }) {
  const local = t - 59_000;
  const armed = local > 6_500;
  return (
    <DashFrame active="Loans">
      <div className="flex h-full flex-col gap-1.5">
        <div style={enter(local, 200)} className="flex items-baseline justify-between">
          <SectionHead>Protect the position — exit orders</SectionHead>
          <span className="rounded-full bg-[var(--accent)] px-1.5 py-px text-[7px] font-bold uppercase tracking-wider text-[var(--accent-ink)]">
            V4 flagship
          </span>
        </div>
        <div style={enter(local, 900)} className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] px-2 py-1.5">
          <Row k="🛑 Stop-loss" v="price −25% → sell enough to cover" strong />
        </div>
        <div style={enter(local, 2_100)} className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] px-2 py-1.5">
          <Row k="🎯 Take-profit" v="price +40% → sell 50%, bank the gain" strong />
        </div>
        <div style={enter(local, 3_300)} className="rounded-lg border border-[var(--hairline)] bg-[var(--bg-elevated)] px-2 py-1.5">
          <Row k="🪜 Ladder" v="25% @ +20% · 25% @ +40% · 50% @ +80%" strong />
          <div className="mt-1.5 flex gap-1">
            <div className="h-1 flex-1 rounded-full bg-[var(--accent-dim)]" />
            <div className="h-1 flex-1 rounded-full bg-[var(--accent)]" />
            <div className="h-1 flex-[2] rounded-full bg-[var(--accent-deep)]" />
          </div>
        </div>
        {armed && (
          <div style={enter(local, 6_500, 350)} className="rounded-lg border border-[var(--accent-deep)] bg-[var(--accent-dim)] px-2 py-1.5 text-center text-[9px]">
            <b>✓ Armed — orders fire in-vault.</b> Loan stays <b>Active</b> · no margin calls.
          </div>
        )}
      </div>
    </DashFrame>
  );
}

function TgBubble({ me = false, children, style }: { me?: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style} className={`flex ${me ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-xl px-2 py-1 text-[9px] leading-snug ${
          me
            ? "rounded-br-sm bg-[var(--accent)] text-[var(--accent-ink)]"
            : "rounded-bl-sm border border-[var(--hairline)] bg-[var(--bg-elevated)] text-[var(--ink)]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function SceneTelegram({ t }: { t: number }) {
  const local = t - 71_000;
  return (
    <div className="absolute inset-0 flex items-start justify-center px-[3%] pt-[2%]" style={{ paddingBottom: CAPTION_CLEAR_PX }}>
      <div className="flex h-full w-full max-w-[300px] flex-col overflow-hidden rounded-xl border border-[var(--hairline-strong)] bg-[var(--bg)] shadow-xl">
        {/* TG chat header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-[var(--hairline)] bg-[var(--bg-elevated)] px-2.5 py-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[10px]">🐦</span>
          <div>
            <div className="text-[10px] font-semibold leading-none">Magpie</div>
            <div className="text-[8px] text-[var(--ink-faint)]">bot · online</div>
          </div>
          <span className="ml-auto text-[9px] text-[var(--ink-faint)]">✈ Telegram</span>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-1.5 p-2.5">
          <TgBubble me style={enter(local, 600)}>/borrow</TgBubble>
          <TgBubble style={enter(local, 1_600)}>
            What would you like to borrow against?
            <div className="mt-1 grid grid-cols-2 gap-1 text-center text-[8px] font-semibold">
              <span className="rounded-md border border-[var(--hairline)] px-1 py-0.5">🪙 WIF</span>
              <span className="rounded-md border border-[var(--hairline)] px-1 py-0.5">📈 GLDx</span>
            </div>
          </TgBubble>
          <TgBubble me style={enter(local, 3_400)}>WIF — 7.7 SOL, Standard</TgBubble>
          <TgBubble style={enter(local, 4_800)}>
            ✅ <b>Loan funded.</b> 7.7 SOL sent to your wallet, 4,200 WIF locked in the vault. Due in 7 days — I&apos;ll remind you.
          </TgBubble>
          <div style={enter(local, 6_600)} className="pt-0.5 text-center text-[8px] text-[var(--ink-faint)]">
            /positions · /extend · /repay · /autoextend — everything works here too
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneRepay({ t }: { t: number }) {
  const local = t - 81_000;
  const done = local > 3_400;
  return (
    <DashFrame active="Loans">
      <div className="flex h-full flex-col items-center justify-center gap-2 pb-2">
        {!done && (
          <div style={enter(local, 300)} className="w-full max-w-[240px] rounded-lg border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] p-2.5 text-center shadow-md">
            <div className="text-[10px] font-semibold">Repay loan #1042</div>
            <div className="mt-1.5 space-y-1 text-left">
              <Row k="Repay" v="7.82 SOL" />
              <Row k="Unlock" v="4,200 WIF" strong />
            </div>
            <div className="mt-2 rounded-md bg-[var(--accent)] py-1 text-[10px] font-semibold text-[var(--accent-ink)]">
              {local > 2_000 ? "Repaying…" : "Repay & unlock"}
            </div>
          </div>
        )}
        {done && (
          <>
            <div style={enter(local, 3_400, 300)} className="flex items-center gap-1.5 text-[11px] font-semibold">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] text-[var(--accent-ink)]">✓</span>
              Loan repaid — vault unlocked
            </div>
            <div style={enter(local, 4_400, 300)} className="rounded-lg border border-[var(--accent-deep)] bg-[var(--accent-dim)] px-4 py-2 text-center">
              <div className="font-display text-base font-semibold">4,200 WIF</div>
              <div className="text-[8px] text-[var(--ink-soft)]">back in your wallet — upside intact</div>
            </div>
          </>
        )}
      </div>
    </DashFrame>
  );
}

function SceneOutro({ t }: { t: number }) {
  const local = t - 88_500;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 pb-10 text-center">
      <div style={enter(local, 300)} className="font-display text-2xl tracking-[-0.03em]">
        Collateral that can
        <br />
        <span className="italic">still sell itself.</span>
      </div>
      <div style={enter(local, 1_500)} className="text-sm text-[var(--ink-soft)]">
        <span className="font-semibold text-[var(--ink)]">magpie.capital</span> · Telegram bot · earn at{" "}
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
      {idx === 2 && <SceneOverview t={t} />}
      {idx === 3 && <SceneChoose t={t} />}
      {idx === 4 && <SceneTerms t={t} />}
      {idx === 5 && <SceneSign t={t} />}
      {idx === 6 && <SceneTrack t={t} />}
      {idx === 7 && <SceneV4 t={t} />}
      {idx === 8 && <SceneTelegram t={t} />}
      {idx === 9 && <SceneRepay t={t} />}
      {idx === 10 && <SceneOutro t={t} />}
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

  // Scenes compose at a fixed design size and scale to the stage, so every
  // width shows the identical composition (never crops).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / DESIGN_W));
    ro.observe(el);
    setScale(el.clientWidth / DESIGN_W);
    return () => ro.disconnect();
  }, []);

  // Deterministic-seek hook — used by the mp4 renderer and the visual
  // regression screenshots. Harmless in production (inert unless called).
  useEffect(() => {
    window.__demoSeek = (ms: number) => {
      setStarted(true);
      setT(Math.max(0, Math.min(DEMO_DURATION_MS, ms)));
    };
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
      {/* Stage — 16:9 */}
      <div ref={stageRef} className="relative aspect-video select-none overflow-hidden bg-[var(--bg)]">
        <div
          className="relative"
          style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <Scenes t={t} />
        </div>

        {/* Captions — overlay on sm+ inside the reserved clear zone; a
            separate strip below the stage on mobile. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden justify-center p-2.5 sm:flex">
          <div
            aria-live="polite"
            className="max-w-[94%] rounded-lg bg-[color-mix(in_srgb,var(--ink)88%,transparent)] px-3 py-1.5 text-center text-[13px] leading-snug text-[var(--bg)]"
          >
            {caption.text}
          </div>
        </div>

        {!started && !exportMode && (
          <button
            onClick={toggle}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[color-mix(in_srgb,var(--bg)55%,transparent)] backdrop-blur-[2px]"
            aria-label="Play the walkthrough"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-2xl text-[var(--accent-ink)] shadow-lg transition-transform group-hover:scale-105">
              ▶
            </span>
            <span className="text-sm font-semibold">See how Magpie works — 90 seconds, captioned</span>
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
