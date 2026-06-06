"use client";

/**
 * Renders a prominent banner when the operator has globally disabled
 * site signed actions (incident response, maintenance). Pulls the new
 * public /api/v1/site-status endpoint every 30s. Stays silent when
 * the site is operating normally.
 */
import { useEffect, useState } from "react";

interface Announcement {
  message: string;
  severity: "info" | "warning" | "critical" | string;
  expires_at: string | null;
}

interface SiteStatus {
  disabled: boolean;
  reason: string | null;
  set_at: string | null;
  announcement: Announcement | null;
}

export default function SiteStatusBanner({ botApiUrl }: { botApiUrl: string }) {
  const [status, setStatus] = useState<SiteStatus | null>(null);

  useEffect(() => {
    if (!botApiUrl) return;
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`${botApiUrl}/api/v1/site-status`);
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setStatus(j);
      } catch {
        /* silent */
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [botApiUrl]);

  if (!status) return null;
  if (!status.disabled && !status.announcement) return null;

  return (
    <div className="space-y-3">
      {status.disabled && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
          <div className="text-sm font-semibold text-red-300">
            🛑 Site signed actions are temporarily disabled
          </div>
          <div className="mt-1 text-xs text-red-200/80 leading-relaxed">
            {status.reason || "Operator-initiated maintenance."} Site signed actions (withdraw, support, wallets switch, prefs, AI chat) will return 503 until this clears. The Telegram bot is unaffected — use{" "}
            <a
              href="https://t.me/magpie_capital_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              @magpie_capital_bot
            </a>{" "}
            for any urgent action.
          </div>
        </div>
      )}

      {status.announcement && (
        <div
          className={`rounded-2xl border p-4 ${
            status.announcement.severity === "critical"
              ? "border-red-500/40 bg-red-500/10"
              : status.announcement.severity === "warning"
                ? "border-amber-500/40 bg-amber-500/10"
                : "border-[var(--d-accent)]/30 bg-[var(--d-accent-dim)]/30"
          }`}
        >
          <div
            className={`text-sm font-semibold ${
              status.announcement.severity === "critical"
                ? "text-red-300"
                : status.announcement.severity === "warning"
                  ? "text-amber-300"
                  : "text-[var(--d-accent-deep)]"
            }`}
          >
            {status.announcement.severity === "critical"
              ? "🚨 Magpie"
              : status.announcement.severity === "warning"
                ? "⚠️ Magpie"
                : "📢 Magpie"}
          </div>
          <div
            className={`mt-1 whitespace-pre-wrap text-xs leading-relaxed ${
              status.announcement.severity === "critical"
                ? "text-red-200/90"
                : status.announcement.severity === "warning"
                  ? "text-amber-200/90"
                  : "text-[var(--d-ink-soft)]"
            }`}
          >
            {status.announcement.message}
          </div>
        </div>
      )}
    </div>
  );
}
