"use client";

/**
 * Wallets surface for linked users.
 *
 * Shows every wallet on the user's Magpie account — both custodial
 * (bot-managed) and externally linked (their own Phantom) — with the
 * source, an "active" badge, and a "Set active" action for non-active
 * custodial wallets. Set-active goes through a signed message so the
 * bot can authenticate the request to the same user.
 *
 * Renders only for linked users. Stays out of the way unless the user
 * has at least one wallet beyond the connected one.
 */
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { siteSetActiveWallet } from "@/lib/solana/site-wallets";

interface WalletRow {
  id: number;
  public_key: string;
  source: "custodial" | "imported" | "site-link" | string;
  label: string | null;
  is_active: boolean;
  managed: boolean;
  created_at: string;
}

function sourceLabel(s: string): string {
  if (s === "custodial") return "Bot-generated";
  if (s === "imported") return "Imported";
  if (s === "site-link") return "Linked from site";
  return s;
}

export default function WalletsList({ botApiUrl }: { botApiUrl: string }) {
  const { publicKey, signMessage } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;

  const [wallets, setWallets] = useState<WalletRow[] | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!walletStr || !botApiUrl) return;
    try {
      const r = await fetch(`${botApiUrl}/api/v1/wallets?wallet=${walletStr}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setLinked(!!j.linked);
      setWallets(Array.isArray(j.wallets) ? j.wallets : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [walletStr, botApiUrl]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSetActive(target: WalletRow) {
    if (!walletStr || !signMessage) {
      setError("Connect a wallet that supports signMessage.");
      return;
    }
    setBusy(target.id);
    setError(null);
    setSuccess(null);
    try {
      await siteSetActiveWallet({
        botApiUrl,
        signerPubkey: walletStr,
        signMessage,
        targetPubkey: target.public_key,
      });
      setSuccess(`Active wallet → ${target.public_key.slice(0, 6)}…${target.public_key.slice(-4)}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (linked === null) return null;
  if (linked === false) return null;
  if (!wallets || wallets.length < 2) return null; // nothing to show if only one wallet

  return (
    <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">
        Wallets · {wallets.length}
      </div>

      <div className="mt-3 divide-y divide-[var(--d-border)]">
        {wallets.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[var(--d-ink-soft)] truncate">
                  {w.public_key}
                </span>
                {w.is_active && (
                  <span className="shrink-0 rounded-full border border-[var(--d-accent)]/30 bg-[var(--d-accent-dim)]/40 px-2 py-0.5 text-[10px] text-[var(--d-accent-deep)]">
                    Active
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[10px] text-[var(--d-ink-faint)]">
                {sourceLabel(w.source)}
                {w.label && <span> · {w.label}</span>}
                {!w.managed && <span className="ml-1">· you hold keys</span>}
              </div>
            </div>
            {!w.is_active && w.managed && (
              <button
                onClick={() => handleSetActive(w)}
                disabled={busy === w.id}
                className="shrink-0 rounded-md border border-[var(--d-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)] disabled:opacity-50"
              >
                {busy === w.id ? "Signing…" : "Set active"}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 text-[10px] text-[var(--d-ink-faint)]">
        The active wallet is the one /borrow, /repay, and site withdraws use. Externally-held wallets (Phantom-style) can't be set active — they sign their own transactions.
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700">
          ✓ {success}
        </div>
      )}
    </div>
  );
}
