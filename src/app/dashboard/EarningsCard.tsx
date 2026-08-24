"use client";

/**
 * Earnings summary card.
 *
 * Pulls the three reward endpoints in parallel — referrals, $MAGPIE
 * holder rewards, and LP loyalty — and shows the combined lifetime
 * + paid + pending totals so users see their full Magpie yield without
 * having to bounce across /refer, /holders, and /earn.
 *
 * Renders for any connected wallet — even non-linked users see holder
 * rewards if they hold $MAGPIE. Hidden if the wallet has zero across
 * all three categories (clean dashboard for new users).
 */
import { useEffect, useState } from "react";
import { formatSol } from "@/lib/format-price";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useDashboardData } from "./DashboardContext";

interface Bucket {
  lifetime_lamports: string;
  paid_lamports: string;
  pending_lamports?: string;
  claimable_lamports?: string;
}

interface Earnings {
  referral: Bucket | null;
  holder: Bucket | null;
  lp: Bucket | null;
}

const LAMPORTS_PER_SOL = 1_000_000_000;

function sol(lamports: string | undefined | null): number {
  if (!lamports) return 0;
  return Number(lamports) / LAMPORTS_PER_SOL;
}

function bucketTotal(b: Bucket | null): {
  lifetime: number;
  paid: number;
  outstanding: number;
} {
  if (!b)
    return { lifetime: 0, paid: 0, outstanding: 0 };
  const lifetime = sol(b.lifetime_lamports);
  const paid = sol(b.paid_lamports);
  // Holder & LP use pending_lamports; referrals use claimable_lamports.
  const outstanding = sol(b.pending_lamports ?? b.claimable_lamports);
  return { lifetime, paid, outstanding };
}

function fmtSol(n: number): string {
  return formatSol(n);
}

export default function EarningsCard({ botApiUrl }: { botApiUrl: string }) {
  const { publicKey } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;
  const ctx = useDashboardData();

  const [data, setData] = useState<Earnings | null>(null);

  // Prefer the consolidated /api/v1/dashboard payload if the provider
  // already fetched it. Falls back to per-endpoint fetches when the
  // context isn't mounted (e.g. component used outside the provider).
  useEffect(() => {
    if (ctx?.data?.earnings) {
      const e = ctx.data.earnings;
      // The consolidated endpoint uses {lifetime, paid, pending} keys.
      // The legacy per-endpoint shape uses {lifetime_lamports, paid_lamports, ...}.
      // Normalize to the legacy keys the existing UI expects.
      const norm = (b: { lifetime: string; paid: string; pending: string } | undefined) =>
        b
          ? {
              lifetime_lamports: b.lifetime,
              paid_lamports: b.paid,
              pending_lamports: b.pending,
            }
          : null;
      setData({
        referral: norm(e.referral),
        holder: norm(e.holder),
        lp: norm(e.lp),
      });
      return;
    }

    if (!walletStr || !botApiUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const [refRes, holderRes, lpRes] = await Promise.all([
          fetch(`${botApiUrl}/api/v1/referrals?wallet=${walletStr}`),
          fetch(`${botApiUrl}/api/v1/holders?wallet=${walletStr}`),
          fetch(`${botApiUrl}/api/v1/lp-loyalty?wallet=${walletStr}`),
        ]);
        const referral = refRes.ok ? await refRes.json() : null;
        const holder = holderRes.ok ? await holderRes.json() : null;
        const lp = lpRes.ok ? await lpRes.json() : null;
        if (cancelled) return;
        setData({
          referral: referral && !referral.error ? referral : null,
          holder: holder && !holder.error ? holder : null,
          lp: lp && !lp.error ? lp : null,
        });
      } catch {
        /* silent — non-critical card */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletStr, botApiUrl, ctx?.data]);

  if (!data) return null;

  const ref = bucketTotal(data.referral);
  const holder = bucketTotal(data.holder);
  const lp = bucketTotal(data.lp);
  const totalLifetime = ref.lifetime + holder.lifetime + lp.lifetime;
  const totalOutstanding = ref.outstanding + holder.outstanding + lp.outstanding;

  // If everything is zero, the user has no earnings to celebrate yet —
  // don't add visual noise. The card will appear when they get their
  // first reward.
  if (totalLifetime === 0) return null;

  const rows: { label: string; href: string; b: ReturnType<typeof bucketTotal>; sub: string }[] = [
    {
      label: "$MAGPIE holder rewards",
      href: "/holders",
      b: holder,
      sub: "Auto-paid on a randomized 5-10d window",
    },
    {
      label: "LP loyalty",
      href: "/earn",
      b: lp,
      sub: "Time-weighted pool deposits",
    },
    {
      label: "Referrals",
      href: "/refer",
      b: ref,
      sub: "10% of referred users' loan fees",
    },
  ];

  return (
    <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">
          Earnings
        </div>
        <div className="text-right">
          <div className="font-mono text-base font-semibold tabular text-[var(--d-ink)]">
            {fmtSol(totalLifetime)} SOL
          </div>
          <div className="text-[10px] text-[var(--d-ink-faint)]">lifetime</div>
        </div>
      </div>

      {totalOutstanding > 0 && (
        <div className="mt-2 rounded-md border border-[var(--d-accent)]/25 bg-[var(--d-accent-dim)]/30 px-3 py-1.5 text-xs text-[var(--d-accent-deep)]">
          <span className="font-mono">{fmtSol(totalOutstanding)} SOL</span> pending
          <span className="ml-1 text-[var(--d-ink-faint)]">· paid automatically</span>
        </div>
      )}

      <div className="mt-3 divide-y divide-[var(--d-border)]">
        {rows
          .filter((r) => r.b.lifetime > 0)
          .map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="text-xs text-[var(--d-ink)]">{r.label}</div>
                <div className="mt-0.5 text-[10px] text-[var(--d-ink-faint)]">{r.sub}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-xs text-[var(--d-ink)] tabular">
                  {fmtSol(r.b.lifetime)} SOL
                </div>
                {r.b.outstanding > 0 && (
                  <Link
                    href={r.href}
                    className="font-mono text-[10px] text-[var(--d-accent-deep)] underline"
                  >
                    {fmtSol(r.b.outstanding)} pending →
                  </Link>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
