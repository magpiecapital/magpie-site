"use client";

/**
 * Renders a prominent banner when the operator has globally disabled
 * site signed actions (incident response, maintenance). Pulls the new
 * public /api/v1/site-status endpoint every 30s. Stays silent when
 * the site is operating normally.
 */
import { useEffect, useState } from "react";

interface SiteStatus {
  disabled: boolean;
  reason: string | null;
  set_at: string | null;
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

  if (!status?.disabled) return null;

  return (
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
  );
}
