"use client";
import { useEffect } from "react";

/**
 * Persists a referral code from the URL into localStorage so a
 * later wallet connect can credit the referrer.
 *
 * Triggered on every page load (mounted in ClientProviders). Reads
 * ?ref=CODE from the URL, sanitizes to alphanumerics, and stores
 * for up to 30 days. The bot's auto-bootstrap path reads this via
 * the link/status fetch and attributes the new user.
 *
 * Idempotent — overwrites any existing stored value with whatever
 * is in the current URL (last referrer wins, matching standard
 * referral attribution semantics). Doesn't store if the URL has
 * no ref param.
 */
const REF_STORAGE_KEY = "magpie_ref";
const REF_STORED_AT_KEY = "magpie_ref_at";
const REF_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function RefCapture() {
  useEffect(() => {
    try {
      // 1) Expire old refs.
      const storedAt = Number(window.localStorage.getItem(REF_STORED_AT_KEY) || 0);
      if (storedAt && Date.now() - storedAt > REF_TTL_MS) {
        window.localStorage.removeItem(REF_STORAGE_KEY);
        window.localStorage.removeItem(REF_STORED_AT_KEY);
      }

      // 2) Capture current ?ref=.
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("ref");
      if (!raw) return;
      // Same sanitization as the bot's regex. Widened for vanity codes:
      // 3–20 chars, letters/numbers/_/- (Telegram-deep-link-safe charset).
      const clean = raw.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,20}$/.test(clean)) return;
      window.localStorage.setItem(REF_STORAGE_KEY, clean);
      window.localStorage.setItem(REF_STORED_AT_KEY, String(Date.now()));
    } catch {
      // Private browsing / quota exhausted — silent ignore.
    }
  }, []);
  return null;
}
