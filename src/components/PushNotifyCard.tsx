"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  checkPushSupport,
  getExistingSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupport,
} from "@/lib/solana/site-push";

/**
 * Browser notifications for loan expiry — the push channel for borrowers the
 * bot cannot DM.
 *
 * Site-native borrowers have no Telegram account behind their Magpie account,
 * so the DM warning never arrives. Over 90 days, 96% of Telegram borrowers who
 * reached the 24h window were warned versus 1.4% of site-only borrowers, and
 * every borrower liquidated with no warning was site-only.
 *
 * SHOWN ONLY WHEN IT MATTERS. With no active loan there is nothing to warn
 * about, so this renders nothing. Asking for notification permission with no
 * stake attached is how people learn to hit "Block" — and a blocked permission
 * can only be undone by the user, in browser settings, which would make the
 * problem permanently worse.
 *
 * HONEST ABOUT NOT WORKING. In-app wallet browsers frequently lack the push
 * API. When that happens the card says so plainly and points at the alternative
 * rather than showing a button that silently fails.
 */
export function PushNotifyCard({
  botApiUrl,
  activeLoanCount,
}: {
  botApiUrl: string;
  activeLoanCount: number;
}) {
  const { publicKey, signMessage } = useWallet();
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = checkPushSupport();
      const existing = s === "ok" ? await getExistingSubscription() : null;
      if (cancelled) return;
      setSupport(s);
      setSubscribed(!!existing);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setErr("Connect a wallet that can sign messages.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await subscribeToPush({
        botApiUrl,
        signerPubkey: publicKey.toBase58(),
        signMessage,
      });
      setSubscribed(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      // Permission may have flipped to "denied" during the attempt.
      setSupport(checkPushSupport());
    } finally {
      setBusy(false);
    }
  }, [botApiUrl, publicKey, signMessage]);

  const disable = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await unsubscribeFromPush(botApiUrl);
      setSubscribed(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [botApiUrl]);

  // Nothing at stake, or still probing → stay out of the way.
  if (support === null || activeLoanCount < 1) return null;

  if (subscribed) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            ✓ Browser notifications on
          </span>
          <button
            onClick={disable}
            disabled={busy}
            className="text-[10px] text-[var(--d-ink-faint)] underline hover:text-[var(--d-ink-soft)] disabled:opacity-50"
          >
            {busy ? "…" : "Turn off"}
          </button>
        </div>
        <div className="mt-0.5 text-[10px] text-[var(--d-ink-faint)]">
          We&apos;ll warn you 24h and 6h before a loan expires, even if this tab is closed.
        </div>
      </div>
    );
  }

  // Can't work here. Say so rather than offering a button that won't function.
  if (support === "unsupported" || support === "denied") {
    return (
      <div className="rounded-lg border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2 text-[10px] leading-relaxed text-[var(--d-ink-soft)]">
        <span className="font-semibold text-[var(--d-ink)]">
          {support === "denied"
            ? "Notifications are blocked in this browser"
            : "This browser can't do notifications"}
        </span>
        <div className="mt-0.5">
          {support === "denied"
            ? "You can re-enable them in your browser's site settings. "
            : "In-app wallet browsers often can't. Open magpie.capital in Safari or Chrome, or "}
          connect Telegram above so we can still reach you before a loan expires.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--d-border)] bg-[var(--d-bg-card)] px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div>
          <div className="text-[11px] font-semibold text-[var(--d-ink)]">
            Get warned before your loan expires
          </div>
          <div className="text-[10px] leading-relaxed text-[var(--d-ink-soft)]">
            A browser notification 24h and 6h before the deadline — no email, no phone number,
            nothing to fill in.
          </div>
        </div>
        <button
          onClick={enable}
          disabled={busy}
          className="w-full shrink-0 rounded-md bg-[var(--d-accent)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--d-accent-ink)] transition hover:brightness-110 disabled:opacity-50 sm:w-auto sm:py-1"
        >
          {busy ? "…" : "Notify me"}
        </button>
      </div>
      {err && <div className="mt-1 text-[10px] text-red-500">{err}</div>}
    </div>
  );
}
