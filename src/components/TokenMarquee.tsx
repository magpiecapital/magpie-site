"use client";

import { useState } from "react";
import { TOKEN_REGISTRY } from "@/lib/token-registry";

const TOKENS = TOKEN_REGISTRY.slice(0, 30); // top 30 for the marquee

function TokenPill({ symbol, mint }: { symbol: string; mint: string }) {
  const [failed, setFailed] = useState(false);
  const src = `https://dd.dexscreener.com/ds-data/tokens/solana/${mint}.png`;

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--bg-elevated)] px-3 py-1.5 shadow-sm">
      {failed ? (
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-dim)] text-[9px] font-bold text-[var(--accent-deep)]">
          {symbol[0]}
        </div>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={symbol}
          className="h-5 w-5 shrink-0 rounded-full"
          onError={() => setFailed(true)}
        />
      )}
      <span className="text-xs font-semibold text-[var(--ink)] whitespace-nowrap">{symbol}</span>
    </div>
  );
}

export function TokenMarquee() {
  const items = [...TOKENS, ...TOKENS];
  return (
    <div className="flex marquee gap-3 py-1">
      {items.map((t, i) => (
        <TokenPill key={`${t.mint}-${i}`} symbol={t.symbol} mint={t.mint} />
      ))}
    </div>
  );
}
