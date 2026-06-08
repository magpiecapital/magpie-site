"use client";

/**
 * Next.js error boundary for the dashboard route.
 *
 * If any client component on /dashboard throws (e.g. a widget crashes
 * on bad API data), this renders instead of a white screen. Logs the
 * error to the console for debugging and gives the user a clear way
 * to recover via reload, while keeping the TG bot as a fallback path
 * for anything urgent.
 */
import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-6">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">
          Dashboard error
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Something on this page broke
        </h1>
        <p className="mt-3 text-sm text-[var(--d-ink-soft)] leading-relaxed">
          Your funds, loans, and account are safe — this was a rendering issue, not a transaction failure. Try reloading. If it persists, the Telegram bot can do everything the dashboard can.
        </p>

        {error.digest && (
          <div className="mt-3 rounded-md bg-[var(--d-bg-card)] border border-[var(--d-border)] px-3 py-2 font-mono text-[10px] text-[var(--d-ink-faint)]">
            Error id: {error.digest}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => reset()}
            className="rounded-md bg-[var(--d-accent-deep)] px-4 py-2 text-sm font-semibold text-[var(--d-accent-ink)] hover:bg-[var(--d-accent)]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-[var(--d-border)] px-4 py-2 text-sm font-semibold text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)]"
          >
            Home
          </Link>
          <a
            href="https://t.me/magpie_capital_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[var(--d-border)] px-4 py-2 text-sm font-semibold text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)]"
          >
            Open in Telegram
          </a>
        </div>
      </div>
    </div>
  );
}
