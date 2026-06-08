"use client";

/**
 * Site-side custodial withdraw.
 *
 * Lets a user move SOL or SPL tokens out of their MAGPIE-CUSTODIAL wallet
 * (the one the bot manages for them) into their connected wallet by
 * signing an authentication message with their linked Phantom.
 *
 * V1 SAFETY: destination is hard-set to the signing wallet — site
 * withdraws can ONLY send funds custodial → linked Phantom. To send
 * elsewhere, the user uses TG /withdraw, which has been live forever.
 * Operator can loosen via MAGPIE_SITE_WITHDRAW_ANY_DEST=1 on the bot
 * later.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { siteWithdraw } from "@/lib/solana/site-withdraw";

const LAMPORTS_PER_SOL = 1_000_000_000n;
const SOL_GAS_RESERVE_LAMPORTS = 5_000_000n;

interface TokenHolding {
  mint: string;
  symbol?: string;
  name?: string;
  raw_amount: string;
  decimals: number;
  amount: number;
}

interface BalancePayload {
  sol: { lamports: string; amount: number };
  tokens: TokenHolding[];
}

interface AssetOption {
  key: string; // "SOL" or mint
  label: string;
  decimals: number;
  rawAvailable: bigint;
}

function formatAmount(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

function parseAmountToRaw(text: string, decimals: number): bigint | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) return null;
  const padded = frac.padEnd(decimals, "0");
  try {
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
  } catch {
    return null;
  }
}

export default function CustodialWithdraw({ botApiUrl }: { botApiUrl: string }) {
  const { publicKey, signMessage } = useWallet();
  const signerPubkey = publicKey?.toBase58() ?? null;

  const [custodial, setCustodial] = useState<string | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [balance, setBalance] = useState<BalancePayload | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [open, setOpen] = useState(false);

  const [assetKey, setAssetKey] = useState<string>("SOL");
  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ signature: string; explorer: string } | null>(null);

  // 1. Resolve the custodial wallet via /link/status (we extended the
  // endpoint to return `active_custodial_wallet` for linked accounts).
  useEffect(() => {
    if (!signerPubkey || !botApiUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${botApiUrl}/api/v1/link/status?wallet=${signerPubkey}`);
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        setLinked(!!j.linked);
        setCustodial(j.active_custodial_wallet ?? null);
      } catch {
        /* silent — non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signerPubkey, botApiUrl]);

  // 2. When opened, fetch the custodial wallet's live balance.
  const loadBalance = useCallback(async () => {
    if (!custodial || !botApiUrl) return;
    setLoadingBalance(true);
    try {
      const r = await fetch(`${botApiUrl}/api/v1/wallet/balance?wallet=${custodial}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setBalance(j);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Couldn't load custodial balance: ${msg}`);
    } finally {
      setLoadingBalance(false);
    }
  }, [custodial, botApiUrl]);

  useEffect(() => {
    if (open) loadBalance();
  }, [open, loadBalance]);

  // 3. Derive the asset options for the picker.
  const assets: AssetOption[] = useMemo(() => {
    if (!balance) return [];
    const out: AssetOption[] = [];
    const solRaw = BigInt(balance.sol.lamports);
    const solAvail = solRaw > SOL_GAS_RESERVE_LAMPORTS ? solRaw - SOL_GAS_RESERVE_LAMPORTS : 0n;
    if (solAvail > 0n) {
      out.push({
        key: "SOL",
        label: `SOL · ${formatAmount(solAvail, 9)}`,
        decimals: 9,
        rawAvailable: solAvail,
      });
    }
    for (const t of balance.tokens) {
      const raw = BigInt(t.raw_amount);
      if (raw <= 0n) continue;
      out.push({
        key: t.mint,
        label: `${t.symbol || t.mint.slice(0, 6) + "…"} · ${formatAmount(raw, t.decimals)}`,
        decimals: t.decimals,
        rawAvailable: raw,
      });
    }
    return out;
  }, [balance]);

  const selectedAsset = assets.find((a) => a.key === assetKey) || assets[0];

  // If selection becomes invalid after balance refresh, snap to first valid.
  useEffect(() => {
    if (assets.length > 0 && !assets.some((a) => a.key === assetKey)) {
      setAssetKey(assets[0].key);
    }
  }, [assets, assetKey]);

  const canSubmit =
    !!signerPubkey &&
    !!custodial &&
    !!signMessage &&
    !!selectedAsset &&
    !submitting;

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    if (!canSubmit || !signerPubkey || !custodial || !signMessage || !selectedAsset) return;

    const rawAmount = parseAmountToRaw(amountInput, selectedAsset.decimals);
    if (rawAmount === null || rawAmount <= 0n) {
      setError("Enter a valid amount.");
      return;
    }
    if (rawAmount > selectedAsset.rawAvailable) {
      setError(
        `Amount exceeds available balance (${formatAmount(selectedAsset.rawAvailable, selectedAsset.decimals)}).`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await siteWithdraw({
        botApiUrl,
        signerPubkey,
        signMessage,
        request: {
          from: custodial,
          to: signerPubkey, // V1 restriction — destination is the signer
          asset: selectedAsset.key,
          rawAmount,
        },
      });
      setSuccess(result);
      setAmountInput("");
      // Refresh balance so the UI reflects the new state.
      loadBalance();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Render nothing if not linked yet — the LinkToTelegram component
  // prompts the user to link. After linking, this surface appears.
  if (linked === false) return null;
  if (linked === null || !custodial) return null;

  return (
    <div className="rounded-2xl border border-[var(--d-border)] bg-[var(--d-bg-card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)]">
            Custodial wallet
          </div>
          <div className="mt-0.5 font-mono text-xs text-[var(--d-ink-soft)] break-all">
            {custodial}
          </div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-md border border-[var(--d-border)] px-3 py-1.5 text-xs font-semibold text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)]"
        >
          {open ? "Close" : "Withdraw"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {loadingBalance && (
            <div className="text-xs text-[var(--d-ink-faint)]">Loading custodial balance…</div>
          )}

          {!loadingBalance && assets.length === 0 && (
            <div className="rounded-md border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2 text-xs text-[var(--d-ink-soft)]">
              Nothing to withdraw — your custodial wallet has no available SOL or tokens.
            </div>
          )}

          {assets.length > 0 && selectedAsset && (
            <>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] mb-1">
                  Asset
                </label>
                <select
                  value={assetKey}
                  onChange={(e) => setAssetKey(e.target.value)}
                  className="w-full rounded-md border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2 text-sm text-[var(--d-ink)]"
                >
                  {assets.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] mb-1">
                  Amount
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="flex-1 rounded-md border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2 text-sm text-[var(--d-ink)] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAmountInput(formatAmount(selectedAsset.rawAvailable, selectedAsset.decimals))
                    }
                    className="rounded-md border border-[var(--d-border)] px-3 py-2 text-xs font-semibold text-[var(--d-ink-soft)] hover:bg-[var(--d-surface-hover)]"
                  >
                    Max
                  </button>
                </div>
                <div className="mt-1 text-[10px] text-[var(--d-ink-faint)]">
                  Available: {formatAmount(selectedAsset.rawAvailable, selectedAsset.decimals)}
                  {selectedAsset.key === "SOL" && (
                    <span className="ml-1">· 0.005 SOL reserved for gas</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.16em] text-[var(--d-ink-faint)] mb-1">
                  Destination
                </label>
                <div className="rounded-md border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2 font-mono text-xs text-[var(--d-ink-soft)] break-all">
                  {signerPubkey}
                </div>
                <div className="mt-1 text-[10px] text-[var(--d-ink-faint)]">
                  Site withdraws can only send to your connected wallet — keeps
                  the signing flow simple and safe. Need to send elsewhere?
                  Ask Pip and we can route it.
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full rounded-md bg-[var(--d-accent-deep)] px-4 py-2.5 text-sm font-semibold text-[var(--d-accent-ink)] hover:bg-[var(--d-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Signing & sending…" : "Sign & withdraw"}
              </button>
            </>
          )}

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
              <div className="font-semibold text-emerald-600">✓ Withdraw confirmed</div>
              <a
                href={success.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block break-all font-mono text-[10px] text-[var(--d-accent-deep)] underline"
              >
                {success.signature}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
