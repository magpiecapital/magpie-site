"use client";

import { useState } from "react";

interface Loan {
  loan_id: string;
  status: string;
  collateral: { symbol: string | null; mint: string };
  loan: { amount_lamports: string | null };
  timestamps: { due_at: string | null };
}

interface Position {
  has_position: boolean;
  shares?: string;
  deposited_lamports?: string;
  current_value_lamports?: string;
  yield_lamports?: string;
  share_of_pool_pct?: number;
}

/**
 * Hands the visitor a free, no-payment, no-keypair-needed peek at any
 * wallet's Magpie footprint — active loans + LP position. Hits the
 * same free endpoints we tell agents to use, so the page itself is
 * a working demo of the API. Conversion ladder: paste → see real data
 * → "this is a real protocol with real activity" → read the install
 * snippet on the same page.
 */
export function WalletLookupWidget() {
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  async function lookup() {
    const w = wallet.trim();
    if (!w) return;
    // Cheap client-side guard — server will reject too if this slips through.
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w)) {
      setError("Not a valid Solana pubkey.");
      return;
    }
    setLoading(true);
    setError(null);
    setLoans(null);
    setPosition(null);
    try {
      const [loansRes, posRes] = await Promise.all([
        fetch(`/api/v1/loans?wallet=${encodeURIComponent(w)}`).then((r) => r.json()),
        fetch(`/api/v1/lp/position/${encodeURIComponent(w)}`).then((r) => r.json()),
      ]);
      // /api/v1/loans returns { wallet, active, history } — pull active.
      const activeLoans = Array.isArray(loansRes.active) ? loansRes.active : [];
      setLoans(activeLoans);
      setPosition(posRes as Position);
    } catch (e) {
      setError(`Lookup failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--ink)]/15 bg-[var(--ink)]/[0.02] p-6 md:p-8">
      <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-3">
        Try it now · free
      </div>
      <h3 className="font-display text-xl md:text-2xl tracking-tight mb-4">
        Look up any wallet&apos;s Magpie position
      </h3>
      <p className="text-sm text-[var(--ink-soft)] mb-5 max-w-2xl">
        Paste a Solana wallet pubkey. We&apos;ll hit{" "}
        <code className="font-mono text-xs">/api/v1/loans</code> and{" "}
        <code className="font-mono text-xs">/api/v1/lp/position/[wallet]</code>{" "}
        — both free, no payment, no signup. This is exactly what your agent does.
      </p>

      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <input
          type="text"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="9UuLs…pump (or any Solana wallet)"
          className="flex-1 px-4 py-3 rounded-lg bg-black/30 font-mono text-sm text-[var(--ink)] border border-[var(--ink)]/15 focus:border-[var(--ink)]/40 focus:outline-none"
          spellCheck={false}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={lookup}
          disabled={loading || !wallet.trim()}
          className="px-6 py-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] hover:opacity-90 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Looking up…" : "Look up"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-500 mb-4">{error}</div>
      )}

      {(loans !== null || position !== null) && !loading && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* LP position card */}
          <div className="rounded-lg border border-[var(--ink)]/10 p-4">
            <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-2">
              LP position
            </div>
            {position?.has_position && position.shares ? (
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-[var(--ink-soft)]">Current value:</span>{" "}
                  <span className="font-mono">
                    {(Number(position.current_value_lamports ?? 0) / 1e9).toFixed(4)} SOL
                  </span>
                </div>
                <div>
                  <span className="text-[var(--ink-soft)]">Deposited:</span>{" "}
                  <span className="font-mono">
                    {(Number(position.deposited_lamports ?? 0) / 1e9).toFixed(4)} SOL
                  </span>
                </div>
                <div>
                  <span className="text-[var(--ink-soft)]">Yield earned:</span>{" "}
                  <span className="font-mono">
                    {(Number(position.yield_lamports ?? 0) / 1e9).toFixed(4)} SOL
                  </span>
                </div>
                <div>
                  <span className="text-[var(--ink-soft)]">Share of pool:</span>{" "}
                  <span className="font-mono">
                    {((position.share_of_pool_pct ?? 0) * 100).toFixed(3)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-[var(--ink-soft)]">
                No LP position. This wallet hasn&apos;t deposited.
              </div>
            )}
          </div>

          {/* Active loans card */}
          <div className="rounded-lg border border-[var(--ink)]/10 p-4">
            <div className="text-xs uppercase tracking-widest text-[var(--ink-soft)] mb-2">
              Active loans ({loans?.length ?? 0})
            </div>
            {loans && loans.length > 0 ? (
              <div className="space-y-2 text-sm">
                {loans.slice(0, 3).map((l) => (
                  <div
                    key={l.loan_id}
                    className="border-b border-[var(--ink)]/10 last:border-0 pb-2 last:pb-0"
                  >
                    <div className="font-mono text-xs">loan_id {l.loan_id}</div>
                    <div>
                      <span className="text-[var(--ink-soft)]">Borrowed:</span>{" "}
                      <span className="font-mono">
                        {(Number(l.loan.amount_lamports ?? 0) / 1e9).toFixed(3)} SOL
                      </span>{" "}
                      {l.collateral.symbol && (
                        <span className="text-[var(--ink-soft)]">
                          against {l.collateral.symbol}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {loans.length > 3 && (
                  <div className="text-xs text-[var(--ink-soft)]">
                    + {loans.length - 3} more
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-[var(--ink-soft)]">
                No active loans for this wallet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
