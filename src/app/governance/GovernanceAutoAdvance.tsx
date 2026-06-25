"use client";

/**
 * GovernanceAutoAdvance — flips the page to the new status at the EXACT second a
 * proposal opens or closes, with no reload and no waiting on a cache window.
 *
 * Status is date-derived server-side (src/lib/governance.ts). This client
 * component takes every upcoming transition timestamp (each proposal's
 * activates_at + closes_at), schedules a router.refresh() for the next one, and
 * re-runs the server render the instant it fires — so a proposal goes
 * Draft → Live (and Live → Closed) on the dot. Paired with force-dynamic on the
 * page, a freshly-loaded page is always correct and a page being watched flips
 * live. The visible countdowns (GovernanceCountdown / VotingCountdown) already
 * tick per-second; this makes the actual status/bucket change land with them.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SETTIMEOUT_MAX = 2_147_000_000; // ~24.8 days — setTimeout's safe ceiling

export function GovernanceAutoAdvance({ thresholdsIso }: { thresholdsIso: string[] }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function scheduleNext() {
      const now = Date.now();
      const next = thresholdsIso
        .map((s) => Date.parse(s))
        .filter((t) => Number.isFinite(t) && t > now)
        .sort((a, b) => a - b)[0];
      if (next === undefined) return; // nothing left to transition

      // Fire a hair AFTER the boundary so the server re-resolves into the NEW
      // state (now >= activates_at / closes_at), then re-arm for the one after.
      const delay = Math.min(next - now + 500, SETTIMEOUT_MAX);
      timer = setTimeout(() => {
        router.refresh();
        // Re-arm shortly after the refresh settles, for the next boundary.
        timer = setTimeout(scheduleNext, 1_500);
      }, Math.max(0, delay));
    }

    scheduleNext();
    return () => { if (timer) clearTimeout(timer); };
  }, [thresholdsIso, router]);

  return null;
}
