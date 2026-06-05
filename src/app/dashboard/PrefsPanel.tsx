"use client";

/**
 * Prefs panel: Auto-Protect + notification toggles for linked users.
 *
 * Auto-Protect (anti-liquidation) is the flagship toggle — the watcher
 * service auto-pays-down loans whose health drops below 1.30x using
 * the user's idle SOL. The other toggles control which DM categories
 * the bot sends.
 *
 * Renders only for linked users.
 */
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { siteSetPref, type PrefKey } from "@/lib/solana/site-prefs";
import { siteMeExport } from "@/lib/solana/site-export";

interface PrefsState {
  auto_protect: boolean;
  auto_repay: boolean;
  notify_deposits: boolean;
  notify_loan_warnings: boolean;
  notify_liquidations: boolean;
  notify_health: boolean;
}

interface SiteLockState {
  locked: boolean;
  until: string | null;
}

interface ActionRow {
  action_type: string;
  amount_lamports: string | null;
  health_before: number | null;
  health_after: number | null;
  signature: string | null;
  loan_id: number | null;
  created_at: string;
}

function ageStr(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / (60 * 24))}d ago`;
}

function fmtSol(lamports: string | null): string {
  if (!lamports) return "—";
  return (Number(lamports) / 1e9).toFixed(4);
}

const TOGGLES: { key: PrefKey; label: string; sublabel: string }[] = [
  {
    key: "auto_protect",
    label: "Auto-Protect",
    sublabel:
      "Auto-pays loans down to 1.50x when health drops below 1.30x. Max 1 SOL per action, 3/loan/24h.",
  },
  {
    key: "notify_health",
    label: "Loan health alerts",
    sublabel: "Get a DM when an active loan's health drops into the warning band.",
  },
  {
    key: "notify_loan_warnings",
    label: "Due-date warnings",
    sublabel: "Get reminders as a loan approaches its due date.",
  },
  {
    key: "notify_liquidations",
    label: "Liquidation alerts",
    sublabel: "Get notified if a loan is liquidated.",
  },
  {
    key: "notify_deposits",
    label: "Deposit confirmations",
    sublabel: "Get a DM when a deposit hits your custodial wallet.",
  },
];

export default function PrefsPanel({ botApiUrl }: { botApiUrl: string }) {
  const { publicKey, signMessage } = useWallet();
  const walletStr = publicKey?.toBase58() ?? null;

  const [linked, setLinked] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState<PrefsState | null>(null);
  const [siteLock, setSiteLock] = useState<SiteLockState | null>(null);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [busyKey, setBusyKey] = useState<PrefKey | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!walletStr || !botApiUrl) return;
    try {
      const r = await fetch(`${botApiUrl}/api/v1/prefs?wallet=${walletStr}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setLinked(!!j.linked);
      if (j.prefs) setPrefs(j.prefs);
      if (j.site_lock) setSiteLock(j.site_lock);
      if (Array.isArray(j.recent_actions)) setActions(j.recent_actions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [walletStr, botApiUrl]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExport() {
    if (!walletStr || !signMessage) {
      setError("Connect a wallet that supports signMessage.");
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const data = await siteMeExport({
        botApiUrl,
        signerPubkey: walletStr,
        signMessage,
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `magpie-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  async function handleToggle(key: PrefKey) {
    if (!walletStr || !signMessage || !prefs) {
      setError("Connect a wallet that supports signMessage.");
      return;
    }
    setBusyKey(key);
    setError(null);
    const nextValue = !prefs[key];
    // Optimistic flip — feels instant. Reverted in the catch on failure.
    setPrefs({ ...prefs, [key]: nextValue });
    try {
      await siteSetPref({
        botApiUrl,
        signerPubkey: walletStr,
        signMessage,
        key,
        value: nextValue,
      });
      load(); // refresh recent activity in case auto_protect was just enabled
    } catch (e) {
      setPrefs((p) => (p ? { ...p, [key]: !nextValue } : p));
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyKey(null);
    }
  }

  if (linked === null) return null;
  if (linked === false) return null;
  if (!prefs) return null;

  return (
    <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">
        Auto-Protect & notifications
      </div>

      {siteLock?.locked && siteLock.until && (
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
          <div className="font-semibold">🔒 Site signed actions are locked</div>
          <div className="mt-0.5 text-amber-700">
            Until {new Date(siteLock.until).toLocaleString()} · Run{" "}
            <code className="rounded bg-amber-500/10 px-1">/lock 0</code>{" "}
            in{" "}
            <a
              href="https://t.me/magpie_capital_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              @magpie_capital_bot
            </a>{" "}
            to clear it.
          </div>
        </div>
      )}

      <div className="mt-3 divide-y divide-[var(--d-border)]">
        {TOGGLES.map(({ key, label, sublabel }) => {
          const on = prefs[key];
          return (
            <div key={key} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--d-ink)]">{label}</div>
                <div className="mt-0.5 text-[10px] text-[var(--d-ink-faint)]">{sublabel}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => handleToggle(key)}
                disabled={busyKey === key}
                className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                  on ? "bg-[var(--d-accent-deep)]" : "bg-[var(--d-border)]"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    on ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {prefs.auto_protect && actions.length > 0 && (
        <div className="mt-3 rounded-md border border-[var(--d-border)] bg-[var(--d-bg-card)] p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--d-ink-faint)]">
            Recent Auto-Protect activity
          </div>
          <div className="mt-2 space-y-1.5">
            {actions.map((a, i) => {
              const ago = ageStr(a.created_at);
              let line: string;
              if (a.action_type === "partial_repay") {
                line = `paid ${fmtSol(a.amount_lamports)} SOL on loan #${a.loan_id} (${a.health_before}→${a.health_after}x)`;
              } else if (a.action_type === "insufficient_funds_warning") {
                line = `couldn't act on #${a.loan_id} — not enough idle SOL`;
              } else if (a.action_type === "partial_repay_failed") {
                line = `failed on #${a.loan_id} — watcher will retry`;
              } else {
                line = a.action_type;
              }
              return (
                <div key={i} className="text-[11px] text-[var(--d-ink-soft)]">
                  <span className="text-[var(--d-ink-faint)]">{ago}</span> · {line}
                  {a.signature && (
                    <a
                      href={`https://solscan.io/tx/${a.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 font-mono text-[10px] text-[var(--d-accent-deep)] underline"
                    >
                      tx
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-[var(--d-border)] pt-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-[var(--d-ink)]">Export my data</div>
          <div className="mt-0.5 text-[10px] text-[var(--d-ink-faint)]">
            Download a JSON file of everything Magpie holds for your account.
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="shrink-0 rounded-md border border-[var(--d-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)] disabled:opacity-50"
        >
          {exporting ? "Signing…" : "Download"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
