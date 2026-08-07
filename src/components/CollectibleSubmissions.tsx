"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * "Your collectibles" on the dashboard — every card this wallet has put
 * through the vetting gate, with where each one stands.
 *
 * This is the retention surface for the collectibles book: a collector who
 * checked a card months ago can come back and see the verdict, the reasons,
 * and what still has to happen. It renders NOTHING when the wallet has no
 * submissions, so it never adds noise for borrowers who don't hold cards.
 *
 * Only ever shows the caller's own rows, and only the public columns the API
 * returns — reviewer notes and abuse signals stay inside the protocol.
 */

interface Submission {
  id: number;
  card: string;
  card_set: string | null;
  card_year: string | null;
  grader: string;
  cert: string;
  grade: string | null;
  auto_grade: string | null;
  platform: string | null;
  verdict: string;
  tier: "A" | "B" | null;
  status: string;
  checks: { name: string; pass: boolean | null; detail: string }[] | null;
  next_steps: string[] | null;
  created_at: string;
}

const VERDICT_LABEL: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = {
  PROVISIONAL_TIER_A: { label: "Provisionally eligible · Tier A", tone: "ok" },
  PROVISIONAL_TIER_B: { label: "Provisionally eligible · Tier B", tone: "ok" },
  CANDIDATE_REVIEW: { label: "In review", tone: "warn" },
  NEEDS_VAULTING: { label: "Needs vaulting", tone: "warn" },
  DECLINED: { label: "Not eligible", tone: "bad" },
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  in_review: "Being reviewed",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export function CollectibleSubmissions({ wallet }: { wallet: string | null }) {
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (!wallet) {
      setRows(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/submit-collectible?wallet=${encodeURIComponent(wallet)}`,
        );
        const data = await res.json();
        if (!cancelled) setRows(Array.isArray(data.submissions) ? data.submissions : []);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  // Nothing submitted → render nothing. This panel is for collectors.
  if (!rows || rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[var(--d-hairline,#26252a)] bg-[var(--d-surface,#15151a)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium tracking-[-0.01em]">
            Your collectibles
          </h2>
          <p className="mt-1 text-[13px] text-[var(--d-ink-soft,#b8b3a4)]">
            Cards you&apos;ve put through the vetting gate.
          </p>
        </div>
        <Link
          href="/collectibles#submit"
          className="text-[13px] font-semibold text-[var(--accent-deep,#e0b340)]"
        >
          Submit another →
        </Link>
      </div>

      <ul className="mt-5 flex flex-col divide-y divide-[var(--d-hairline,#26252a)]">
        {rows.map((r) => {
          const v = VERDICT_LABEL[r.verdict] ?? { label: r.verdict, tone: "warn" as const };
          const isOpen = open === r.id;
          return (
            <li key={r.id} className="py-3">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.card}</div>
                  <div className="mt-0.5 text-[12px] text-[var(--d-ink-faint,#6e6a60)]">
                    {[
                      r.card_set,
                      r.card_year,
                      `${r.grader} ${r.cert}`,
                      r.grade ? `grade ${r.grade}` : null,
                      r.auto_grade ? `auto ${r.auto_grade}` : null,
                      r.platform || "not vaulted",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      v.tone === "ok"
                        ? "bg-[var(--accent-dim,#3b3520)] text-[var(--accent-deep,#e0b340)]"
                        : v.tone === "warn"
                          ? "border border-[var(--d-hairline,#26252a)] text-[var(--d-ink-soft,#b8b3a4)]"
                          : "border border-[var(--d-hairline,#26252a)] text-[var(--d-ink-faint,#6e6a60)]"
                    }`}
                  >
                    {v.label}
                  </span>
                  <span className="text-[11px] text-[var(--d-ink-faint,#6e6a60)]">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="mt-3 rounded-xl border border-[var(--d-hairline,#26252a)] bg-black/20 p-4">
                  {r.checks?.length ? (
                    <ul className="flex flex-col gap-2">
                      {r.checks.map((c) => (
                        <li key={c.name} className="flex items-start gap-2.5">
                          <span
                            aria-hidden
                            className={`mt-[3px] text-[11px] ${
                              c.pass === true
                                ? "text-emerald-500"
                                : c.pass === false
                                  ? "text-red-400"
                                  : "text-[var(--d-ink-faint,#6e6a60)]"
                            }`}
                          >
                            {c.pass === true ? "✓" : c.pass === false ? "✕" : "…"}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium">{c.name}</div>
                            <p className="text-[12px] leading-relaxed text-[var(--d-ink-soft,#b8b3a4)]">
                              {c.detail}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {r.next_steps?.length ? (
                    <div className="mt-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--d-ink-faint,#6e6a60)]">
                        What happens next
                      </div>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {r.next_steps.map((n) => (
                          <li
                            key={n}
                            className="text-[12px] leading-relaxed text-[var(--d-ink-soft,#b8b3a4)]"
                          >
                            → {n}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--d-ink-faint,#6e6a60)]">
        Collectibles lending is in design — nothing here is a loan offer, and
        eligibility is confirmed against live sold data at loan time.
      </p>
    </section>
  );
}
