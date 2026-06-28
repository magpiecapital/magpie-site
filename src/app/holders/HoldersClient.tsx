"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { DiamondIcon } from "@/components/DiamondIcon";
import { Header } from "@/components/Header";

const TELEGRAM_URL = "https://t.me/magpie_capital_bot";
const PUMP_URL = "https://pump.fun/coin/9UuLsJ3jf8ViBNeRcwXD53re5G3ypgfKK3s2EiMMpump";
// Post-MGP-001 split, ratified 2026-06-13: 70/10/10/10.
// 70% holders, 10% LP loyalty, 10% referrer, 10% protocol reserve.
const REWARD_PCT = 70;
const LP_PCT = 10;
const REFERRER_PCT = 10;
const PROTOCOL_PCT = 10;

interface HolderData {
  magpie_balance_raw: string;
  magpie_balance: number;
  has_balance: boolean;
  reward_bps: number;
  reward_pct: number;
  lifetime_lamports: string;
  paid_lamports: string;
  pending_lamports: string;
  distributions_count: number;
  estimated_next_payout_lamports: string;
  auto_distribute: boolean;
}

function fmtSol(lamports: string | number) {
  const n = typeof lamports === "string" ? Number(lamports) : lamports;
  return (n / 1e9).toFixed(6);
}

function fmtMagpie(raw: string | number) {
  const n = (typeof raw === "string" ? Number(raw) : raw) / 1e6;
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

export default function HoldersClient() {
  const { connected, publicKey } = useWallet();
  const [data, setData] = useState<HolderData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch user holder data when wallet connected
  useEffect(() => {
    if (!connected || !publicKey) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/holders?wallet=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setData(j?.data ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, publicKey]);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:px-6 md:pt-24 md:pb-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent)]">
            <DiamondIcon className="h-3 w-3" />
            <span>$MAGPIE · holders</span>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
            Hold $MAGPIE. <span className="text-[var(--accent)]">Earn</span> from every loan.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-[var(--ink-soft)] sm:text-lg">
            <span className="font-semibold text-[var(--ink)]">70% of every loan fee</span>{" "}
            on Magpie accrues to a holder reward pool, distributed on a randomized
            5–10 day cadence to every $MAGPIE holder pro-rata. Real yield, on-chain
            payout, no staking, no lockup.
          </p>

          {/* Pool size intentionally hidden from the public hero — pairing
              pool size with accrual rate would let mercenary holders estimate
              when a distribution is imminent. The accrual is invisible. */}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={PUMP_URL} target="_blank" rel="noopener noreferrer" className="btn-accent shimmer text-sm sm:text-base">
              Buy $MAGPIE →
            </a>
            <Link href="/dashboard" className="btn-ghost text-sm sm:text-base">
              Connect on dashboard
            </Link>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-sm sm:text-base text-[var(--ink-soft)] hover:text-[var(--accent-deep)] hover:underline">
              or use Telegram
            </a>
          </div>
        </div>
      </section>

      {/* CONNECTED WALLET PANEL */}
      <section className="border-y border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
          {!connected && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 text-center sm:p-8">
              <p className="text-sm text-[var(--ink-soft)]">
                Connect your wallet to see your $MAGPIE balance and pending rewards.
              </p>
            </div>
          )}

          {connected && loading && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 text-center text-sm text-[var(--ink-soft)]">
              Loading your holder stats…
            </div>
          )}

          {connected && !loading && data && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                  Your $MAGPIE balance
                </div>
                <div className="mt-2 font-mono text-3xl font-semibold text-[var(--ink)]">
                  {fmtMagpie(data.magpie_balance_raw)}
                </div>
                {!data.has_balance && (
                  <p className="mt-3 text-sm text-[var(--ink-soft)]">
                    You don't hold $MAGPIE yet. Grab some to start earning a share of every
                    loan fee.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={PUMP_URL} target="_blank" rel="noopener noreferrer" className="btn-accent text-sm">
                    Buy on pump.fun
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                  Your rewards
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Stat label="Lifetime received" value={`${fmtSol(data.paid_lamports)} SOL`} />
                  <Stat label="Distributions" value={data.distributions_count.toString()} />
                  <Stat label="Reward rate" value={`${data.reward_pct}%`} />
                  <Stat label="Reward token" value="SOL" />
                </div>
                <div className="mt-5 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
                    Estimated next payout
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--ink)]">
                    ~{fmtSol(data.estimated_next_payout_lamports)} SOL
                  </div>
                  <p className="mt-2 text-xs text-[var(--ink-soft)]">
                    Sent automatically to this wallet on the next distribution. Estimate
                    moves with the live pool size — no action needed on your end.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* MECHANICS */}
      <section id="how" className="border-b border-[var(--hairline)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="mb-10 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            How it works
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Step n={1} title="Loans pay fees">
              Every borrow + extend on Magpie charges a fee. Per MGP-001 (passed 2026-06-13), the split is 70% to $MAGPIE holders, 10% to LP loyalty, 10% to referrers, 10% to the protocol reserve.
            </Step>
            <Step n={2} title="Periodic snapshots">
              The protocol snapshots every wallet holding $MAGPIE on-chain (excluding
              DEX pools and protocol accounts) at random intervals — keeping holders
              honest and farmers out.
            </Step>
            <Step n={3} title="Auto-paid in SOL">
              Each holder's pro-rata share is sent directly to their wallet on the
              snapshot. No claim button, no signing — SOL just appears.
            </Step>
          </div>
        </div>
      </section>

      {/* FEE SPLIT */}
      <section className="border-b border-[var(--hairline)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="mb-10 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            Fee split
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Holder-first. Real revenue, real on-chain.
              </h2>
              <p className="mt-4 max-w-xl text-base text-[var(--ink-soft)]">
                Per MGP-001 (ratified 2026-06-13), every loan fee splits 70/10/10/10
                across $MAGPIE holders, LP loyalty, referrers, and the protocol reserve.
                Holders get the largest slice — paid in real SOL, sourced from real
                loan activity. Snapshot fires on a 5–10 day random cadence; SOL lands
                in any wallet holding $MAGPIE at snapshot time.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6 sm:p-8">
              <Row label="$MAGPIE holders" pct={REWARD_PCT} highlight />
              <Row label="LP loyalty (depositors)" pct={LP_PCT} highlight={false} />
              <Row label="Referrers" pct={REFERRER_PCT} highlight={false} />
              <Row label="Protocol reserve" pct={PROTOCOL_PCT} highlight={false} />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
          <div className="mb-10 text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            FAQ
          </div>
          <div className="space-y-6">
            <Faq q="Do I have to stake to earn?">
              No. Just hold $MAGPIE in any wallet you control. The protocol snapshots
              on-chain balances directly — no staking contract, no lockup.
            </Faq>
            <Faq q="How do I receive my SOL?">
              Automatically. On a randomized 5–10 day cadence the protocol snapshots
              all $MAGPIE holders and sends each their pro-rata share via on-chain
              transfer. SOL just appears in the wallet that holds $MAGPIE — no claim
              button, no signing, no bot account needed.
            </Faq>
            <Faq q="When do distributions happen?">
              Periodically. Snapshots fire at random within an internal window — the
              exact time isn't published, on purpose. This stops mercenary holders from
              buying just before a snapshot and dumping right after. Long-term holders
              catch more snapshots and earn proportionally more.
            </Faq>
            <Faq q="Which wallets are eligible?">
              Every on-chain $MAGPIE holder is eligible except: DEX pool accounts
              (Raydium, Orca, Meteora), the pump.fun bonding curve, known burn addresses,
              and the protocol's own wallet.
            </Faq>
            <Faq q="What if a transfer fails?">
              Failed transfers are automatically retried on the next cycle. Your reward
              stays earmarked until it lands in your wallet — nothing is lost to RPC
              flakiness.
            </Faq>
            <Faq q="How are LPs compensated under MGP-001?">
              LPs receive the 10% LP loyalty slice of every loan fee, distributed by shares × time held on the same snapshot cadence. Pre-MGP-001 LPs kept 80% as share-price growth; voters chose to reweight more heavily toward $MAGPIE holders (the 70% slice) when MGP-001 passed 2026-06-13. The lending pool is still safety-stacked the same way — LP capital still backs the loan book.
            </Faq>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <a href={PUMP_URL} target="_blank" rel="noopener noreferrer" className="btn-accent text-base">
              Buy $MAGPIE →
            </a>
            <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="btn-ghost text-base">
              Check your rewards in the bot
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface)] p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">{label}</div>
      <div className="mt-1 text-base font-semibold text-[var(--ink)]">{value}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6">
      <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)]/15 font-mono text-sm text-[var(--accent)]">
        {n}
      </div>
      <div className="text-base font-semibold">{title}</div>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">{children}</p>
    </div>
  );
}

function Row({ label, pct, highlight }: { label: string; pct: number; highlight: boolean }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className={highlight ? "font-semibold text-[var(--accent)]" : "text-[var(--ink-soft)]"}>
          {label}
        </span>
        <span className="font-mono">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--surface)]">
        <div
          className={highlight ? "h-2 rounded-full bg-[var(--accent)]" : "h-2 rounded-full bg-[var(--ink-faint)]"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--bg-elevated)] p-6">
      <div className="font-medium text-[var(--ink)]">{q}</div>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">{children}</p>
    </div>
  );
}
