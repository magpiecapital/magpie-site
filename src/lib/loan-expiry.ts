/**
 * Loan expiry urgency — the warning a website borrower never receives.
 *
 * WHY THIS EXISTS. Measured on production, last 90 days:
 *
 *   Telegram borrowers reaching the 24h window:  68 of 71 warned  (96%)
 *   Site-only borrowers reaching the 24h window:   1 of 72 warned  (1.4%)
 *
 * Nine borrowers were liquidated in that window having received no warning at
 * all. All nine were site-only. Not one had opted out; one had a thirty-day
 * loan and was told nothing.
 *
 * The cause is not a bug in the bot. Loans opened on the website create a stub
 * user row with a synthetic `site_<wallet-prefix>` handle and no real Telegram
 * account behind it, so every DM to them fails with `chat not found`. The
 * warning system is Telegram-only, and roughly a third of borrowers never touch
 * Telegram. For them there is no notification path at all.
 *
 * This module is the site-side channel. It cannot push, so it cannot fully
 * replace a DM — but the dashboard is the surface these borrowers actually use,
 * and today it tells them nothing beyond a 10px "Due in 31h" that only turns
 * red once the loan is already overdue.
 *
 * THRESHOLDS ARE DELIBERATELY THE BOT'S. 24h and 6h are exactly the checkpoints
 * `loan-watcher` uses. If the two surfaces disagreed, a borrower could see a
 * calm dashboard and an urgent DM about the same loan in the same minute.
 *
 * Pure and synchronous. Never throws — a malformed date must render nothing
 * rather than take the dashboard down.
 */

export type ExpiryTier =
  /** Not close enough to be worth interrupting anyone about. */
  | "none"
  /** Inside 48h. Informational — plenty of time, but worth knowing. */
  | "approaching"
  /** Inside 24h. The bot's first checkpoint. */
  | "urgent"
  /** Inside 6h. The bot's second checkpoint. */
  | "critical"
  /** Past due. Collateral is liquidatable now. */
  | "overdue"
  /** Unusable input — render nothing. */
  | "unknown";

export interface ExpiryUrgency {
  tier: ExpiryTier;
  /** Milliseconds until due. Negative once overdue. */
  msLeft: number;
  /** Human phrase for the time remaining, e.g. "5h 20m", "2 days". */
  label: string;
}

/** Widest window we surface anything at all. */
const APPROACHING_MS = 48 * 3_600_000;
const URGENT_MS = 24 * 3_600_000;
const CRITICAL_MS = 6 * 3_600_000;

/**
 * Render a duration the way a person would say it.
 * Always rounds DOWN, so we never imply more time than there is.
 */
export function fmtDuration(ms: number): string {
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60_000);
  if (mins < 1) return "less than a minute";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hours = Math.floor(abs / 3_600_000);
  if (hours < 24) {
    const rem = Math.floor((abs % 3_600_000) / 60_000);
    return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  }
  const days = Math.floor(abs / 86_400_000);
  const remH = Math.floor((abs % 86_400_000) / 3_600_000);
  if (days < 7 && remH > 0) return `${days}d ${remH}h`;
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Classify how urgent this loan's deadline is.
 *
 * @param dueAt ISO timestamp from `loan.timestamps.due_at` (untrusted).
 * @param now   injectable for tests; defaults to the client clock.
 */
export function computeExpiryUrgency(
  dueAt: unknown,
  now: number = Date.now(),
): ExpiryUrgency {
  const unknown: ExpiryUrgency = { tier: "unknown", msLeft: 0, label: "" };
  try {
    if (typeof dueAt !== "string" && !(dueAt instanceof Date)) return unknown;
    const due = dueAt instanceof Date ? dueAt.getTime() : Date.parse(dueAt);
    // Date.parse returns NaN for anything it cannot read.
    if (!Number.isFinite(due)) return unknown;

    const msLeft = due - now;
    const label = fmtDuration(msLeft);

    if (msLeft <= 0) return { tier: "overdue", msLeft, label };
    if (msLeft <= CRITICAL_MS) return { tier: "critical", msLeft, label };
    if (msLeft <= URGENT_MS) return { tier: "urgent", msLeft, label };
    if (msLeft <= APPROACHING_MS) return { tier: "approaching", msLeft, label };
    return { tier: "none", msLeft, label };
  } catch {
    return unknown;
  }
}

/** Should the dashboard interrupt the borrower about this loan? */
export function shouldWarn(tier: ExpiryTier): boolean {
  return tier === "approaching" || tier === "urgent" || tier === "critical" || tier === "overdue";
}
