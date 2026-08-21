"use client";

/**
 * Auto-typing terminal that walks through a REAL agent borrow via x402 —
 * exact production endpoint paths, prices, and response shapes. Labeled a
 * simulated session (no live keys fire from a marketing page); every line
 * mirrors what the production rail actually returns.
 *
 * Plays once when scrolled into view; replay button; reduced-motion users
 * get the full transcript instantly.
 */
import { useEffect, useRef, useState } from "react";

type Line = { t: "cmd" | "out" | "ok" | "note"; s: string; d?: number };

const SCRIPT: Line[] = [
  { t: "note", s: "# an autonomous agent takes a loan — no account, no API key, no human" },
  { t: "cmd", s: "GET https://x402.magpie.capital/api/v1/simulate-borrow?mint=WIF&amount=1000  (free)" },
  { t: "out", s: '{ "collateral_value_sol": 2.41, "options": [ { "tier": "Express", "ltv": "30%", "receive_sol": 0.723, "days": 2 } ] }' },
  { t: "cmd", s: "POST https://x402.magpie.capital/api/v1/agent/build-borrow" },
  { t: "out", s: 'HTTP/1.1 402 Payment Required\n{ "x402Version": 2, "accepts": [{ "scheme": "exact", "network": "solana", "maxAmountRequired": "0.005 SOL", "payTo": "4JSS…zPAx" }] }' },
  { t: "ok", s: "agent pays 0.005 SOL on-chain → sig 5vGh…c2Nq" },
  { t: "cmd", s: "POST /agent/build-borrow  ·  X-PAYMENT: 5vGh…c2Nq" },
  { t: "out", s: '{ "unsigned_tx": "AeQb…", "loan_option": "Express", "expires_in_s": 90 }' },
  { t: "ok", s: "agent signs with ITS OWN wallet → submits → confirmed in 4.1s" },
  { t: "out", s: '{ "loan_id": 1904, "status": "active", "borrower": "agent wallet", "principal_sol": 0.723, "due": "+2 days" }' },
  { t: "cmd", s: "GET /credit-score?wallet=agent  (0.001 SOL)" },
  { t: "out", s: '{ "score": 641, "trend": "+12 on last on-time repay", "attestation": "ed25519:…" }' },
  { t: "note", s: "# repay on time → score climbs → portable, signed reputation any protocol can verify" },
];

export function AgentDemoTerminal() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const [chars, setChars] = useState(0);
  const [started, setStarted] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (rm) {
      setReduced(true);
      setShown(SCRIPT.length);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started || reduced || shown >= SCRIPT.length) return;
    const line = SCRIPT[shown];
    const full = line.s.length;
    if (chars < full) {
      const speed = line.t === "cmd" ? 14 : 4; // commands "type", output "streams"
      const id = setTimeout(() => setChars((c) => Math.min(full, c + (line.t === "cmd" ? 1 : 6))), speed);
      return () => clearTimeout(id);
    }
    const pause = line.t === "ok" ? 650 : 380;
    const id = setTimeout(() => {
      setShown((n) => n + 1);
      setChars(0);
    }, pause);
    return () => clearTimeout(id);
  }, [started, reduced, shown, chars]);

  const replay = () => {
    setShown(0);
    setChars(0);
    setStarted(true);
  };

  const color = (t: Line["t"]) =>
    t === "cmd" ? "text-[var(--accent)]" : t === "ok" ? "text-emerald-400" : t === "note" ? "text-[var(--ink-soft)] italic" : "text-[var(--ink)]/80";

  return (
    <div ref={ref} className="rounded-2xl border border-[var(--ink)]/15 bg-[#0b0f0d] p-1 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-[11px] uppercase tracking-widest text-white/40">
            agent session · simulated replay of the production x402 flow
          </span>
        </div>
        <button
          type="button"
          onClick={replay}
          className="text-[11px] uppercase tracking-widest text-white/50 hover:text-white/90 transition"
        >
          ▶ replay
        </button>
      </div>
      <div className="px-4 md:px-5 py-4 font-mono text-[12.5px] leading-relaxed min-h-[340px] overflow-x-auto">
        {SCRIPT.slice(0, shown + 1).map((line, i) => {
          const text = i < shown ? line.s : line.s.slice(0, chars);
          if (i === shown && chars === 0 && (reduced ? false : true) && shown >= SCRIPT.length) return null;
          return (
            <pre key={i} className={`whitespace-pre-wrap break-words ${color(line.t)} ${line.t === "cmd" ? "mt-3" : "mt-1"}`}>
              {line.t === "cmd" ? "» " : line.t === "ok" ? "✓ " : ""}
              {text}
              {i === shown && !reduced && shown < SCRIPT.length && <span className="animate-pulse">▌</span>}
            </pre>
          );
        })}
        {shown >= SCRIPT.length && (
          <pre className="mt-4 text-white/35">— session complete · every path, price and field above is the live production shape —</pre>
        )}
      </div>
    </div>
  );
}
