"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface LeaderRow {
  score: number;
  tier: string;
  loans_scored: number;
  username: string;
}

const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  diamond: { label: "Diamond", cls: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" },
  platinum: { label: "Platinum", cls: "border-zinc-300/40 bg-zinc-300/10 text-zinc-200" },
  gold: { label: "Gold", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300" },
  silver: { label: "Silver", cls: "border-zinc-400/40 bg-zinc-400/10 text-zinc-300" },
  bronze: { label: "Bronze", cls: "border-orange-400/40 bg-orange-400/10 text-orange-300" },
};

function tierClass(tier: string): { label: string; cls: string } {
  return (
    TIER_BADGE[tier?.toLowerCase()] ?? {
      label: tier || "—",
      cls: "border-[var(--hairline)]/20 bg-[var(--surface)]/5 text-[var(--ink)]/60",
    }
  );
}

export default function LeaderboardClient() {
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || "https://magpie-bot-production.up.railway.app";
    if (!botApi) {
      setError("Leaderboard unavailable — bot API not configured");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${botApi}/api/v1/credit/leaderboard`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (!cancelled) setRows(Array.isArray(j.leaderboard) ? j.leaderboard : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-24">
        <div className="mb-10">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--ink)]/40">
            Credit · top 20
          </div>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Leaderboard
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-[var(--ink)]/60 leading-relaxed">
            The top Magpie borrowers ranked by on-chain credit score. Every on-time repayment moves you up.{" "}
            <Link href="/credit" className="underline hover:text-[var(--ink)]">
              How the score works →
            </Link>
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!rows && !error && (
          <div className="overflow-hidden rounded-2xl border border-[var(--hairline)]/10 bg-[var(--surface)]/5">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 border-b border-[var(--hairline)]/10 bg-[var(--surface)]/5 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-[var(--ink)]/40">
              <div>#</div>
              <div>Borrower</div>
              <div className="text-right">Loans</div>
              <div className="text-right">Score</div>
            </div>
            <div className="divide-y divide-[var(--hairline)]/5">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3.5"
                >
                  <div className="h-3 w-4 animate-pulse rounded bg-[var(--ink)]/10" />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-32 animate-pulse rounded bg-[var(--ink)]/10" />
                    <div className="h-4 w-14 animate-pulse rounded-full bg-[var(--ink)]/10" />
                  </div>
                  <div className="ml-auto h-3 w-6 animate-pulse rounded bg-[var(--ink)]/10" />
                  <div className="h-4 w-10 animate-pulse rounded bg-[var(--ink)]/10" />
                </div>
              ))}
            </div>
          </div>
        )}

        {rows && rows.length === 0 && (
          <div className="rounded-2xl border border-[var(--hairline)]/10 bg-[var(--surface)]/5 p-6 text-sm text-[var(--ink)]/50">
            No scored borrowers yet — be the first.
          </div>
        )}

        {rows && rows.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[var(--hairline)]/10 bg-[var(--surface)]/5">
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 border-b border-[var(--hairline)]/10 bg-[var(--surface)]/5 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-[var(--ink)]/40">
              <div>#</div>
              <div>Borrower</div>
              <div className="text-right">Loans</div>
              <div className="text-right">Score</div>
            </div>
            <div className="divide-y divide-[var(--hairline)]/5">
              {rows.map((r, i) => {
                const tier = tierClass(r.tier);
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3.5"
                  >
                    <div className="w-6 text-right font-mono text-sm text-[var(--ink)]/40 tabular">
                      {i + 1}
                    </div>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm text-[var(--ink)]/90">{r.username}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${tier.cls}`}>
                        {tier.label}
                      </span>
                    </div>
                    <div className="text-right font-mono text-xs text-[var(--ink)]/50 tabular">
                      {r.loans_scored}
                    </div>
                    <div className="text-right font-mono text-base font-semibold tabular text-[var(--ink)]">
                      {r.score}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-[var(--ink)]/40">
          Identifiers shown are Telegram handles where available; users without one appear as “anonymous”. The wallet behind each entry stays private.
        </p>
      </main>
      <Footer />
    </div>
  );
}
