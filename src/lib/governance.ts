/**
 * governance.ts — THE SINGLE SOURCE OF TRUTH for proposal status.
 * ───────────────────────────────────────────────────────────────────────────
 * Why this file exists: proposal status used to be a STATIC literal hardcoded
 * separately in /governance, /governance/proposal/[id], and /api/v1/governance.
 * Nobody flipped MGP-003 "draft"→"active" on its open date (so a published,
 * dated, open proposal showed "Draft"), and MGP-001 was left "active" for weeks
 * after it had already passed. Three surfaces, three different wrong answers.
 *
 * The rule now: a proposal's status is DERIVED FROM ITS DATES, never typed by
 * hand. The only manual step left is recording the FINAL outcome once votes are
 * tallied (which genuinely requires judgement) — and that's an explicit
 * `terminal` field. Everything else — opening on the activation date, closing on
 * the close date — happens automatically. Set the dates once; every surface
 * stays correct forever.
 *
 * IMPORTANT: any surface that renders proposal status MUST resolve it through
 * `resolveProposalStatus()` / `isVotingOpen()` here. Never re-hardcode a status
 * string in a page or route. Pages that show status must also be dynamic/ISR
 * (e.g. `export const revalidate = 60`) so the date logic re-evaluates at
 * request time rather than freezing at build time.
 */

export interface ResultSummary {
  yes_pct: number;
  no_pct: number;
  abstain_pct: number;
  participation_pct: number;
  quorum_pct: number;
  threshold_pct: number;
  notes?: string;
  /**
   * Multi-choice (plurality) result — present for allocation votes like MGP-003.
   * When `winner_choice` is set, surfaces render the per-option breakdown instead
   * of the binary YES/NO. Binary proposals (e.g. MGP-001) leave these undefined,
   * and the yes/no fields above are set to 0 on a multi-choice result (unused).
   */
  winner_choice?: string; // e.g. "C"
  winner_label?: string; // e.g. "Build (24-month locked Growth Treasury)"
  winner_share_pct?: number; // e.g. 56.06
  per_choice?: { value: string; label: string; pct: number }[];
}

/**
 * A human-recorded terminal outcome. Set this ONLY once voting is tallied or the
 * proposal is withdrawn. Its presence overrides the date-driven status (a passed
 * proposal stays "passed" forever, regardless of the clock).
 */
export type TerminalOutcome =
  | { kind: "passed"; outcome: ResultSummary; executed_at_iso?: string; execution_notes?: string }
  | { kind: "failed"; outcome: ResultSummary }
  | { kind: "withdrawn"; at_iso: string; reason: string };

export interface ProposalLifecycle {
  id: string;
  /** Voting opens (draft/upcoming → active). UTC ISO. */
  activates_at_iso: string;
  /** Voting closes (active → tallying). UTC ISO. */
  closes_at_iso: string;
  /** Set once tallied/withdrawn; overrides date-driven status. */
  terminal?: TerminalOutcome;
}

/**
 * The lifecycle registry — the ONE place proposal schedules + outcomes live.
 * To open a future proposal: add it here with its dates and NO terminal. It will
 * go live automatically at `activates_at_iso`. To close one: add the `terminal`.
 */
export const PROPOSAL_LIFECYCLES: Record<string, ProposalLifecycle> = {
  "MGP-001": {
    id: "MGP-001",
    activates_at_iso: "2026-06-10T22:00:00Z",
    closes_at_iso: "2026-06-13T22:00:00Z",
    terminal: {
      kind: "passed",
      outcome: {
        yes_pct: 98,
        no_pct: 2,
        abstain_pct: 0,
        participation_pct: 8.72,
        quorum_pct: 5,
        threshold_pct: 66.6,
        notes: "37 of 2,185 eligible voters cast; quorum (5%) and threshold (66.6%) both cleared.",
      },
      executed_at_iso: "2026-06-13T22:00:00Z",
      execution_notes:
        "70/10/10/10 loan-fee split in effect for every loan originated after execution. Forward-only.",
    },
  },
  "MGP-002": {
    id: "MGP-002",
    activates_at_iso: "2026-06-09T00:00:00Z",
    closes_at_iso: "2026-06-09T23:59:59Z",
    terminal: {
      kind: "withdrawn",
      at_iso: "2026-06-09T00:00:00Z",
      reason:
        "Operator shipped the Premium tier directly under Tier-B discretion (15-day and 30-day durations, tokenized stocks only). Vote became redundant before it opened.",
    },
  },
  "MGP-003": {
    id: "MGP-003",
    activates_at_iso: "2026-06-25T00:00:00Z",
    closes_at_iso: "2026-06-30T00:00:00Z",
    // Closed 2026-06-30. Plurality winner: Option C — Build (24-month locked
    // Growth Treasury). Quorum (7.5%) + plurality (>40%) both cleared. NO burn.
    terminal: {
      kind: "passed",
      outcome: {
        yes_pct: 0,
        no_pct: 0,
        abstain_pct: 0,
        participation_pct: 19.55,
        quorum_pct: 7.5,
        threshold_pct: 40,
        notes:
          "Plurality winner: Option C — Build (24-month locked Growth Treasury). Quorum (7.5%) + plurality (>40%) both cleared. NO burn — total supply unchanged.",
        winner_choice: "C",
        winner_label: "Build (24-month locked Growth Treasury)",
        winner_share_pct: 62.53,
        per_choice: [
          { value: "C", label: "Build (locked Growth Treasury)", pct: 62.53 },
          { value: "D", label: "Discipline + Build (50% burn / 50% treasury)", pct: 33.48 },
          { value: "A", label: "Patience (36-month re-lock)", pct: 3.55 },
          { value: "B", label: "Loyalty (24-month holder vest)", pct: 0.42 },
        ],
      },
      // executed_at_iso is set once the on-chain treasury allocation lands (within 14 days of the July 1 unlock).
    },
  },
};

/** Effective, derived status kinds. */
export type ResolvedKind = "upcoming" | "active" | "tallying" | "passed" | "failed" | "withdrawn";

export interface ResolvedStatus {
  kind: ResolvedKind;
  activates_at_iso: string;
  closes_at_iso: string;
  /** Present when a terminal outcome has been recorded. */
  terminal?: TerminalOutcome;
  /** True only while voting is genuinely open right now. */
  votingOpen: boolean;
}

/**
 * Resolve a proposal's CURRENT status from its dates (+ any recorded terminal).
 * This is the function every surface must call. Returns null for unknown ids.
 *
 *   terminal set            → that outcome (passed / failed / withdrawn), always
 *   now < activates_at_iso  → "upcoming"  (a true draft, not yet open)
 *   activates ≤ now < close → "active"    (voting open NOW)
 *   now ≥ closes_at_iso     → "tallying"  (voting closed, final result pending)
 */
export function resolveProposalStatus(id: string, now: Date = new Date()): ResolvedStatus | null {
  const p = PROPOSAL_LIFECYCLES[id.toUpperCase()];
  if (!p) return null;
  const base = { activates_at_iso: p.activates_at_iso, closes_at_iso: p.closes_at_iso };

  if (p.terminal) {
    return { kind: p.terminal.kind, ...base, terminal: p.terminal, votingOpen: false };
  }

  const t = now.getTime();
  const opens = Date.parse(p.activates_at_iso);
  const closes = Date.parse(p.closes_at_iso);
  let kind: ResolvedKind;
  if (t < opens) kind = "upcoming";
  else if (t < closes) kind = "active";
  else kind = "tallying";
  return { kind, ...base, votingOpen: kind === "active" };
}

/** True iff voting for `id` is open at `now`. The one gate vote UIs should use. */
export function isVotingOpen(id: string, now: Date = new Date()): boolean {
  return resolveProposalStatus(id, now)?.votingOpen ?? false;
}

/** Which lifecycle bucket a resolved kind belongs to, for list grouping. */
export function bucketOf(kind: ResolvedKind): "active" | "upcoming" | "completed" {
  if (kind === "active") return "active";
  if (kind === "upcoming") return "upcoming";
  return "completed"; // tallying / passed / failed / withdrawn
}
