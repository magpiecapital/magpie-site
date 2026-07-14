"use client";

/**
 * ReconnectWelcome — site-side re-engagement for returning dormant borrowers.
 *
 * Web-only past borrowers have no messaging channel (synthetic telegram_id, no
 * email) — the only way to reach them is when they come back and connect a
 * wallet. When a connected wallet turns out to be a past borrower with NO active
 * loans right now (i.e. they borrowed before and drifted), we surface a warm,
 * dismissible "welcome back + here's auto-sell" prompt with a borrow CTA.
 *
 * Purely additive + client-only. Reads the same /api/v1/loans the dashboard uses;
 * shows nothing for new wallets or anyone with an active loan. Dismissal is
 * remembered per-wallet (14 days) so it never nags.
 */
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";

const DISMISS_KEY = "magpie_reconnect_dismissed_v1";
const DISMISS_MS = 14 * 24 * 3600 * 1000;

function dismissedRecently(wallet: string): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, number>;
    return !!map[wallet] && Date.now() - map[wallet] < DISMISS_MS;
  } catch {
    return false;
  }
}

function rememberDismiss(wallet: string) {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[wallet] = Date.now();
    localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
  } catch {
    /* localStorage unavailable — non-fatal */
  }
}

export function ReconnectWelcome() {
  const { publicKey } = useWallet();
  const [state, setState] = useState<{ loans: number; usedAutoSell: boolean } | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setState(null);
      return;
    }
    const wallet = publicKey.toBase58();
    if (dismissedRecently(wallet)) return;

    let cancelled = false;
    fetch(`/api/v1/loans?wallet=${encodeURIComponent(wallet)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.ok) return;
        const active: unknown[] = Array.isArray(d.active) ? d.active : [];
        const history: any[] = Array.isArray(d.history) ? d.history : [];
        // Returning DORMANT borrower: has past loans, none active right now.
        if (history.length > 0 && active.length === 0) {
          const usedAutoSell = history.some(
            (l) => Number(l?.collateral?.auto_sells_fired ?? 0) > 0,
          );
          setState({ loans: history.length, usedAutoSell });
        }
      })
      .catch(() => {
        /* couldn't load — just don't show anything */
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  if (!state || !publicKey) return null;

  const dismiss = () => {
    rememberDismiss(publicKey.toBase58());
    setState(null);
  };

  const lead = state.usedAutoSell
    ? "Welcome back. You've borrowed with Magpie before — and used auto-sell like a pro."
    : `Welcome back — you've taken ${state.loans} ${state.loans === 1 ? "loan" : "loans"} with Magpie before.`;

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 60,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        className="card fade-up"
        style={{
          pointerEvents: "auto",
          maxWidth: 540,
          width: "100%",
          padding: "18px 20px",
          borderRadius: 20,
          border: "1px solid var(--hairline-strong)",
          boxShadow: "var(--shadow-lg)",
          background: "var(--bg-elevated)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span
            aria-hidden
            style={{
              flex: "none",
              width: 40,
              height: 40,
              borderRadius: 12,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--accent)",
              color: "var(--accent-ink)",
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            ↩
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.35, color: "var(--ink)" }}>
              {lead}
            </div>
            <div style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.5, color: "var(--ink-soft)" }}>
              New since you were here: set your <b>take-profit &amp; stop-loss right inside the loan</b> —
              it auto-sells and repays itself, so you never watch a chart. Borrow against your bag without
              selling, and never get liquidated on price.
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/dashboard" className="btn-accent" style={{ fontSize: 14, padding: "0.6rem 1.1rem" }}>
                Borrow again <span aria-hidden>→</span>
              </Link>
              <button
                onClick={dismiss}
                style={{
                  fontSize: 14,
                  padding: "0.6rem 1rem",
                  borderRadius: 9999,
                  border: "1px solid var(--hairline-strong)",
                  background: "transparent",
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                }}
              >
                Maybe later
              </button>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              flex: "none",
              background: "transparent",
              border: "none",
              color: "var(--ink-faint)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
