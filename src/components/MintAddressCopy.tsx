"use client";

import { useState } from "react";

/**
 * Copyable $MAGPIE mint-address chip for the x402 marketing page.
 *
 * The address is passed in (and hard-coded at the call site) so a single
 * character can never silently drift — copying the WRONG mint sends a buyer
 * to the wrong token, which is catastrophic. We render the exact string and
 * copy that exact string; there is no transformation in between.
 */
export function MintAddressCopy({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable (insecure context / denied) — no-op; the
      // address is fully visible on screen for manual copy.
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      title="Copy $MAGPIE mint address"
      aria-label={`Copy $MAGPIE mint address ${address}`}
      className="group inline-flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--ink)]/20 bg-black/30 px-4 py-3 text-left transition hover:border-[var(--accent)]/60"
    >
      <code className="font-mono text-xs md:text-sm break-all text-[var(--ink)] select-all">
        {address}
      </code>
      <span
        className={`shrink-0 font-mono text-[10px] uppercase tracking-widest transition ${
          copied ? "text-emerald-500" : "text-[var(--ink-soft)] group-hover:text-[var(--accent)]"
        }`}
      >
        {copied ? "Copied ✓" : "Copy"}
      </span>
    </button>
  );
}
