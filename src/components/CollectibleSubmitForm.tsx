"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  GRADERS,
  SUPPORTED_PLATFORMS,
  vetSubmission,
} from "@/lib/collectible-vetting";

/**
 * Submit a card to be considered as collateral. The form deliberately asks
 * only for what's on the slab label plus where it's vaulted — that's every
 * input the vetting gate can actually use.
 *
 * The result is shown in full, including the checks that did NOT pass, so a
 * collector always knows why. No outcome here is a loan offer.
 */

interface Result {
  verdict: string;
  headline: string;
  checks: { name: string; pass: boolean | null; detail: string }[];
  next: string[];
  tier: "A" | "B" | null;
}

const VERDICT_STYLE: Record<string, { label: string; tone: string }> = {
  PROVISIONAL_TIER_A: { label: "Provisionally eligible · Tier A", tone: "ok" },
  PROVISIONAL_TIER_B: { label: "Provisionally eligible · Tier B", tone: "ok" },
  CANDIDATE_REVIEW: { label: "Accepted for review", tone: "warn" },
  NEEDS_VAULTING: { label: "Needs vaulting first", tone: "warn" },
  DECLINED: { label: "Not eligible", tone: "bad" },
};

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-faint)]">
        {label}
      </span>
      {children}
      {hint && <span className="text-[11px] text-[var(--ink-faint)]">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

export function CollectibleSubmitForm() {
  // Attaching the connected wallet is what turns a one-off check into
  // something the collector can come back to on their dashboard.
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? "";

  const [form, setForm] = useState({
    grader: "PSA",
    cert: "",
    card: "",
    set: "",
    year: "",
    grade: "",
    autoGrade: "",
    platform: "",
    mint: "",
    contact: "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/submit-collectible", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, wallet }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Something went wrong. Try again.");
      else setResult(data);
    } catch {
      setError("Couldn't reach the vetting service. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const style = result ? VERDICT_STYLE[result.verdict] : null;

  // Live pre-check: the vetting gate is pure and synchronous, so we can run
  // it on every keystroke and show the collector where they stand BEFORE
  // they submit. The server run stays authoritative (it records the attempt
  // and does the on-chain ownership check) — this is the same rules, sooner.
  const preview = useMemo(() => {
    if (result) return null; // the real verdict replaces the preview
    if (!form.card.trim() || form.card.trim().length < 4) return null;
    if (!form.cert.trim()) return null;
    if (!form.grade.trim() && !form.autoGrade.trim()) return null;
    try {
      return vetSubmission({
        grader: form.grader,
        cert: form.cert,
        card: form.card,
        set: form.set,
        year: form.year,
        grade: form.grade,
        autoGrade: form.autoGrade,
        platform: form.platform,
      });
    } catch {
      return null;
    }
  }, [form, result]);
  const previewStyle = preview ? VERDICT_STYLE[preview.verdict] : null;

  return (
    <div className="mx-auto max-w-3xl">
      <form onSubmit={submit} className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-5 sm:p-7">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Which card?" hint="As it reads on the slab label.">
              <input
                className={inputCls}
                value={form.card}
                onChange={set("card")}
                placeholder="Base Set Charizard #4 Shadowless"
                required
                maxLength={120}
              />
            </Field>
          </div>

          <Field label="Grader">
            <select className={inputCls} value={form.grader} onChange={set("grader")}>
              {GRADERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cert number" hint="Printed on the slab.">
            <input
              className={inputCls}
              value={form.cert}
              onChange={set("cert")}
              placeholder="26573583"
              inputMode="numeric"
              required
              maxLength={20}
            />
          </Field>

          <Field label="Card grade" hint="8–10. Leave blank for an authenticated auto.">
            <input
              className={inputCls}
              value={form.grade}
              onChange={set("grade")}
              placeholder="10"
              inputMode="decimal"
              maxLength={4}
            />
          </Field>

          <Field label="Autograph grade" hint="9–10, if the slab is an authenticated auto.">
            <input
              className={inputCls}
              value={form.autoGrade}
              onChange={set("autoGrade")}
              placeholder="10"
              inputMode="decimal"
              maxLength={4}
            />
          </Field>

          <Field label="Set">
            <input
              className={inputCls}
              value={form.set}
              onChange={set("set")}
              placeholder="Base Set"
              maxLength={80}
            />
          </Field>

          <Field label="Year">
            <input
              className={inputCls}
              value={form.year}
              onChange={set("year")}
              placeholder="1999"
              inputMode="numeric"
              maxLength={8}
            />
          </Field>

          <Field label="Where is it vaulted?" hint="Leave blank if it isn't tokenized yet.">
            <select className={inputCls} value={form.platform} onChange={set("platform")}>
              <option value="">Not vaulted yet</option>
              {SUPPORTED_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Token mint address"
            hint="If it's tokenized. We check on-chain that you hold it."
          >
            <input
              className={inputCls}
              value={form.mint}
              onChange={set("mint")}
              placeholder="Token mint of the vaulted card"
              maxLength={64}
            />
          </Field>

          <Field label="How do we reach you?" hint="Telegram handle or email. Optional.">
            <input
              className={inputCls}
              value={form.contact}
              onChange={set("contact")}
              placeholder="@yourhandle"
              maxLength={80}
            />
          </Field>
        </div>

        {preview && previewStyle && (
          <div
            className="mt-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--bg-elevated)] px-3.5 py-2.5"
            aria-live="polite"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
              Live pre-check
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                previewStyle.tone === "ok"
                  ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                  : previewStyle.tone === "warn"
                    ? "bg-[var(--accent-dim)] text-[var(--accent-deep)]"
                    : "border border-[var(--hairline-strong)] text-[var(--ink-faint)]"
              }`}
            >
              {previewStyle.label}
            </span>
            <span className="text-[12px] text-[var(--ink-soft)]">
              {preview.verdict === "DECLINED"
                ? "Same rules as the full check — details on submit."
                : "Looking good so far — submit to run the full check and record it."}
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={busy} className="btn-accent text-sm disabled:opacity-60">
            {busy ? "Checking…" : "Check my card"}
            {!busy && <span aria-hidden>→</span>}
          </button>
          <span className="text-[12px] text-[var(--ink-faint)]">
            Runs the real vetting gate. Nothing here is a loan offer.
          </span>
          {wallet ? (
            <span className="text-[12px] text-[var(--accent-deep)]">
              Saving to your dashboard.
            </span>
          ) : (
            <span className="text-[12px] text-[var(--ink-faint)]">
              Connect a wallet to keep this in your dashboard.
            </span>
          )}
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-[var(--ink-faint)]">
          Everything here is checked. We verify the cert against the grader&apos;s own
          records and confirm on-chain that you hold the card before any loan — so
          details that don&apos;t match the slab simply won&apos;t clear.
        </p>

        {error && (
          <p className="mt-4 text-sm text-[var(--bad)]" role="alert">
            {error}
          </p>
        )}
      </form>

      {result && style && (
        <div
          className="mt-5 rounded-3xl border bg-[var(--bg-elevated)] p-5 sm:p-7"
          style={{
            borderColor:
              style.tone === "ok"
                ? "color-mix(in srgb, var(--accent) 55%, transparent)"
                : "var(--hairline)",
          }}
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                style.tone === "ok"
                  ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                  : style.tone === "warn"
                    ? "bg-[var(--accent-dim)] text-[var(--accent-deep)]"
                    : "border border-[var(--hairline-strong)] text-[var(--ink-faint)]"
              }`}
            >
              {style.label}
            </span>
          </div>
          <p className="mt-3 font-display text-lg font-medium tracking-[-0.01em] sm:text-xl">
            {result.headline}
          </p>

          <ul className="mt-5 flex flex-col divide-y divide-[var(--hairline)]">
            {result.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-3 py-3">
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] ${
                    c.pass === true
                      ? "bg-emerald-500/15 text-emerald-500"
                      : c.pass === false
                        ? "bg-[var(--bad)]/15 text-[var(--bad)]"
                        : "border border-[var(--hairline-strong)] text-[var(--ink-faint)]"
                  }`}
                >
                  {c.pass === true ? "✓" : c.pass === false ? "✕" : "…"}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium sm:text-sm">{c.name}</div>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ink-soft)] sm:text-[13px]">
                    {c.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* [T-22] A scammer screenshotting this result to sell a fake card to
              someone else is the sharpest risk on this surface — it costs a
              stranger money using our name. That makes this the one line that
              MUST survive a screenshot, so it's a visible notice rather than
              the faintest text in the panel, which is what it used to be. */}
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--hairline-strong)] bg-[var(--surface)] px-3.5 py-3">
            <span aria-hidden className="mt-[1px] text-sm text-[var(--ink-faint)]">
              ⓘ
            </span>
            <p className="text-[12px] leading-relaxed text-[var(--ink-soft)] sm:text-[13px]">
              This is an <span className="font-semibold text-[var(--ink)]">eligibility
              check</span> — not an authentication and not a valuation. It does not
              verify your card is genuine and it does not price it.{" "}
              <span className="font-semibold text-[var(--ink)]">Never treat it as
              proof of either.</span>
            </p>
          </div>

          {result.next.length > 0 && (
            <div className="mt-5 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4 sm:p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-faint)]">
                What happens next
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {result.next.map((n) => (
                  <li
                    key={n}
                    className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[var(--ink-soft)] sm:text-sm"
                  >
                    <span aria-hidden className="mt-[2px] text-[var(--accent-deep)]">
                      →
                    </span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
              {/* The verdict decides the door we open — never a dead end. */}
              <div className="mt-4 flex flex-wrap gap-3">
                {result.verdict === "NEEDS_VAULTING" && (
                  <Link href="/collectibles/tokenize" className="btn-accent text-sm">
                    Start the tokenize path<span aria-hidden>→</span>
                  </Link>
                )}
                {(result.verdict === "PROVISIONAL_TIER_A" ||
                  result.verdict === "PROVISIONAL_TIER_B") && (
                  <Link href="/collectibles" className="btn-ghost text-sm">
                    See assets like yours in the catalog
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
