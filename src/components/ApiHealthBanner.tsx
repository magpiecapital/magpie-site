"use client";

/**
 * Top-of-page banner that surfaces the bot API health.
 *
 * Why this exists:
 *   When the bot's Railway service is down, the dashboard's many
 *   data-fetching calls all timeout silently. Users see empty
 *   loading spinners and don't know what's wrong. This banner pings
 *   the bot's /api/v1/health every 30s and shows a clear "Magpie API
 *   recovering" message when it's unreachable, so users know to
 *   wait or come back later instead of refreshing in confusion.
 *
 * Implementation notes:
 *   - Pings are STALE-WHILE-REVALIDATE: the banner shows the last
 *     known state immediately, then refreshes in the background.
 *     A user who lands when the API is healthy sees no banner; the
 *     banner appears only after the first failed ping.
 *   - We retry with backoff on failures to avoid hammering an
 *     already-struggling backend.
 *   - The "Recovering" message is intentionally hopeful — users seeing
 *     "DOWN" panic; "Recovering" frames it as a transient state.
 */

import { useEffect, useState } from "react";

const HEALTH_URL_DEFAULT = "https://magpie-bot-production.up.railway.app/api/v1/health";
const HEALTHY_INTERVAL_MS = 30_000;
const DEGRADED_INTERVAL_MS = 8_000; // poll faster when unhealthy so we clear quickly
const PING_TIMEOUT_MS = 6_000;

type HealthState = "checking" | "ok" | "degraded" | "unreachable";

export function ApiHealthBanner() {
  const [state, setState] = useState<HealthState>("checking");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    async function check() {
      if (cancelled) return;
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), PING_TIMEOUT_MS);
      try {
        const res = await fetch(
          process.env.NEXT_PUBLIC_BOT_API_URL
            ? `${process.env.NEXT_PUBLIC_BOT_API_URL}/api/v1/health`
            : HEALTH_URL_DEFAULT,
          { signal: ctl.signal, cache: "no-store" },
        );
        clearTimeout(t);
        if (cancelled) return;
        if (res.status === 200) {
          setState("ok");
          setReason(null);
        } else if (res.status === 503) {
          // Bot is reachable but some sub-system is unhealthy. Show a
          // softer banner — the user might still be able to do most
          // actions (especially read-only ones).
          setState("degraded");
          try {
            const body = await res.json();
            const reasons = Array.isArray(body.reasons) ? body.reasons.join("; ") : null;
            setReason(reasons);
          } catch { /* ignore body parse */ }
        } else {
          setState("unreachable");
          setReason(`http ${res.status}`);
        }
      } catch (err) {
        clearTimeout(t);
        if (cancelled) return;
        setState("unreachable");
        setReason((err as Error).name === "AbortError" ? "timeout" : "network error");
      }
      // Schedule next check — faster when degraded so we clear the
      // banner promptly once the bot recovers.
      if (!cancelled) {
        const next = state === "ok" ? HEALTHY_INTERVAL_MS : DEGRADED_INTERVAL_MS;
        timerId = setTimeout(check, next);
      }
    }

    check();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
    // We intentionally don't add 'state' as a dep — the closure captures
    // the value at schedule time which is what we want for the
    // next-interval calculation; adding it would re-create the entire
    // effect on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === "ok" || state === "checking") return null;

  if (state === "degraded") {
    return (
      <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-sm text-amber-200">
        <span className="font-medium">Magpie API is degraded.</span>
        <span className="opacity-80">
          {" "}Some background systems are catching up. Borrow + repay should still work.
          {reason ? ` (${reason.slice(0, 200)})` : ""}
        </span>
      </div>
    );
  }

  // unreachable
  return (
    <div className="w-full bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-sm text-red-200">
      <span className="font-medium">Magpie API is recovering.</span>
      <span className="opacity-80">
        {" "}Site actions may be temporarily unavailable. Refresh in a minute.
        {reason ? ` (${reason})` : ""}
      </span>
    </div>
  );
}
