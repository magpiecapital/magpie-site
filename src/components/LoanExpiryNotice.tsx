"use client";

import { computeExpiryUrgency, shouldWarn, type ExpiryTier } from "@/lib/loan-expiry";

/**
 * The expiry warning a website borrower would otherwise never get.
 *
 * Site-only borrowers have no Telegram account behind their stub user row, so
 * every warning DM fails with `chat not found`. Measured: 1 of 72 site-only
 * borrowers who reached the 24h window were warned, against 68 of 71 on
 * Telegram — and all nine unwarned liquidations in 90 days were site-only.
 *
 * COPY RULES (same standard as RepayReadinessNote):
 *  - Say the consequence plainly. "Your collateral can be sold" is the fact
 *    nobody told those nine people. Softening it here would repeat the mistake.
 *  - Never blame. Missing a deadline is not a character failure, and an
 *    accusatory tone makes people avoid the dashboard rather than act on it.
 *  - Always name the way out. Every tier says what to do, not just what's wrong.
 *  - Escalate honestly. A loan 40 hours out should not shout; one 3 hours out
 *    should. Crying wolf early is why people ignore the real warning later.
 */

const STYLES: Record<
  Exclude<ExpiryTier, "none" | "unknown">,
  { box: string; head: string; icon: string }
> = {
  approaching: {
    box: "border-[var(--d-border)] bg-[var(--d-surface)]",
    head: "text-[var(--d-ink-soft)]",
    icon: "🗓",
  },
  urgent: {
    box: "border-amber-500/30 bg-amber-500/10",
    head: "text-amber-600 dark:text-amber-400",
    icon: "⚠️",
  },
  critical: {
    box: "border-red-500/40 bg-red-500/10",
    head: "text-red-600 dark:text-red-400",
    icon: "🚨",
  },
  overdue: {
    box: "border-red-500/50 bg-red-500/15",
    head: "text-red-600 dark:text-red-400",
    icon: "🚨",
  },
};

export function LoanExpiryNotice({
  dueAt,
  onRepay,
  onExtend,
}: {
  dueAt: string | Date | null | undefined;
  onRepay?: () => void;
  onExtend?: () => void;
}) {
  const u = computeExpiryUrgency(dueAt);
  if (u.tier === "unknown" || u.tier === "none" || !shouldWarn(u.tier)) return null;

  const s = STYLES[u.tier];

  const headline =
    u.tier === "overdue"
      ? `Past due by ${u.label}`
      : u.tier === "critical"
        ? `Due in ${u.label} — act now`
        : u.tier === "urgent"
          ? `Due in ${u.label}`
          : `Due in ${u.label}`;

  const body =
    u.tier === "overdue"
      ? "Your collateral can be sold at any time to close this loan. Repaying now still returns whatever remains in the vault — it is not too late until it has actually been sold."
      : u.tier === "critical"
        ? "If this loan is not repaid or extended before the deadline, your collateral will be sold to close it."
        : u.tier === "urgent"
          ? "If this loan is not repaid or extended before the deadline, your collateral will be sold to close it. Extending renews it for another full term."
          : "You can repay any time before the deadline, or extend to renew it for another full term.";

  return (
    <div
      className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed text-[var(--d-ink-soft)] ${s.box}`}
      role={u.tier === "critical" || u.tier === "overdue" ? "alert" : "status"}
    >
      <div className={`font-semibold ${s.head}`}>
        <span aria-hidden="true">{s.icon}</span> {headline}
      </div>
      <div className="mt-0.5">{body}</div>
      {(onRepay || onExtend) && (
        <div className="mt-1.5 flex gap-2">
          {onRepay && (
            <button
              onClick={onRepay}
              className="rounded-md border border-[var(--d-border)] bg-[var(--d-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--d-ink)] transition hover:opacity-80"
            >
              Repay now
            </button>
          )}
          {onExtend && (
            <button
              onClick={onExtend}
              className="rounded-md border border-[var(--d-border)] px-2 py-1 text-[11px] text-[var(--d-ink-soft)] transition hover:opacity-80"
            >
              Extend
            </button>
          )}
        </div>
      )}
    </div>
  );
}
