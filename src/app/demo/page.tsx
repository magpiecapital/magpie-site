"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Logo";
import { Header } from "@/components/Header";

/* ─── Fake keys (deterministic, never real) ─── */
const OWNER_KEY = "7xKm4R...3pQz";
const AGENT_KEY = "9fLn8W...8mWr";
const VAULT_PDA = "4k2pYN...9mNz";

function fakeSig() {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s.slice(0, 4) + "..." + s.slice(4);
}

/* ─── Security check layers ─── */
const SECURITY_LAYERS = [
  { id: 1, label: "Vault is active" },
  { id: 2, label: "Session not expired" },
  { id: 3, label: "Caller is assigned agent" },
  { id: 4, label: "Amount ≤ per-tx limit" },
  { id: 5, label: "Daily total ≤ daily cap" },
  { id: 6, label: "Balance ≥ amount + rent" },
];

/* ─── Step definitions ─── */
type StepDef = {
  id: string;
  label: string;
  caption: string;
  instruction: string;
  signer: "owner" | "agent";
};

const STEPS: StepDef[] = [
  {
    id: "create",
    label: "Create vault",
    caption: "Owner creates a vault PDA with spending policy: 0.5 SOL per-tx, 2.0 SOL daily, 24h session. Then deposits 5 SOL.",
    instruction: "create_vault + deposit",
    signer: "owner",
  },
  {
    id: "spend-ok",
    label: "Agent spends (success)",
    caption: "Agent sends 0.3 SOL to a destination. All 6 security checks pass on-chain.",
    instruction: "agent_spend",
    signer: "agent",
  },
  {
    id: "spend-fail",
    label: "Agent exceeds limit (blocked)",
    caption: "Agent tries 0.6 SOL — exceeds 0.5 per-tx limit. Transaction reverts at layer 4.",
    instruction: "agent_spend",
    signer: "agent",
  },
  {
    id: "revoke",
    label: "Owner revokes access",
    caption: "Owner calls revoke_agent. Agent immediately blocked at the very first check.",
    instruction: "revoke_agent",
    signer: "owner",
  },
  {
    id: "summary",
    label: "Summary",
    caption: "Full transaction log. Every action enforced on-chain — no SDK or API can bypass it.",
    instruction: "—",
    signer: "owner",
  },
];

type CheckStatus = "pending" | "checking" | "pass" | "fail" | "skipped";

type TxLogEntry = {
  instruction: string;
  status: "success" | "error";
  sig: string;
  detail: string;
  error?: string;
  amount?: string;
};

/* ─── Page ─── */
export default function DemoPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [phase, setPhase] = useState<"init" | "signing" | "checking" | "result">("init");
  const [checks, setChecks] = useState<CheckStatus[]>(Array(6).fill("pending"));
  const [txLog, setTxLog] = useState<TxLogEntry[]>([]);

  // Vault simulation state
  const [vault, setVault] = useState({
    balance: 0,
    spentToday: 0,
    isActive: false,
    txCount: 0,
    spendLimit: 0.5,
    dailyLimit: 2.0,
    exists: false,
  });

  const step = STEPS[activeStep];

  const goToStep = useCallback((idx: number) => {
    setActiveStep(idx);
    setPhase("init");
    setChecks(Array(6).fill("pending"));
    setIsPaused(false);
  }, []);

  // Reset vault state when going backwards
  useEffect(() => {
    if (activeStep === 0) {
      setVault({ balance: 0, spentToday: 0, isActive: false, txCount: 0, spendLimit: 0.5, dailyLimit: 2.0, exists: false });
      setTxLog([]);
    }
  }, [activeStep]);

  // Step animation timeline
  useEffect(() => {
    if (activeStep === 4) {
      setPhase("result");
      return;
    }

    setPhase("init");
    setChecks(Array(6).fill("pending"));

    const t1 = setTimeout(() => setPhase("signing"), 600);

    let checkTimers: ReturnType<typeof setTimeout>[] = [];

    const t2 = setTimeout(() => {
      if (activeStep === 0) {
        // Create vault — no security checks, just result
        setPhase("result");
        setVault({ balance: 5.0, spentToday: 0, isActive: true, txCount: 0, spendLimit: 0.5, dailyLimit: 2.0, exists: true });
        setTxLog((prev) => [
          ...prev,
          { instruction: "create_vault", status: "success", sig: fakeSig(), detail: "Vault created with policy", amount: "5.0 SOL deposited" },
        ]);
        return;
      }

      if (activeStep === 3) {
        // Revoke — no security checks
        setPhase("result");
        setVault((v) => ({ ...v, isActive: false }));
        setTxLog((prev) => [
          ...prev,
          { instruction: "revoke_agent", status: "success", sig: fakeSig(), detail: "Agent access revoked" },
        ]);
        return;
      }

      // Security check cascade for spend steps
      setPhase("checking");

      const failAt = activeStep === 1 ? -1 : activeStep === 2 ? 3 : 0; // fail index (0-based), -1 = all pass
      const isRevoked = activeStep === 3;

      for (let i = 0; i < 6; i++) {
        const delay = i * 350;

        checkTimers.push(
          setTimeout(() => {
            setChecks((prev) => {
              const next = [...prev];
              next[i] = "checking";
              return next;
            });
          }, delay)
        );

        checkTimers.push(
          setTimeout(() => {
            setChecks((prev) => {
              const next = [...prev];
              if (failAt >= 0 && i === failAt) {
                next[i] = "fail";
                // Mark remaining as skipped
                for (let j = i + 1; j < 6; j++) next[j] = "skipped";
              } else if (failAt >= 0 && i > failAt) {
                next[i] = "skipped";
              } else {
                next[i] = "pass";
              }
              return next;
            });
          }, delay + 250)
        );
      }

      // Show result after all checks
      const totalCheckTime = 6 * 350 + 400;
      checkTimers.push(
        setTimeout(() => {
          setPhase("result");
          if (failAt === -1) {
            // Success spend
            setVault((v) => ({
              ...v,
              balance: Math.max(0, v.balance - 0.3),
              spentToday: v.spentToday + 0.3,
              txCount: v.txCount + 1,
            }));
            setTxLog((prev) => [
              ...prev,
              { instruction: "agent_spend", status: "success", sig: fakeSig(), detail: "0.3 SOL sent to destination", amount: "0.3 SOL" },
            ]);
          } else {
            // Failed spend
            const errorName = failAt === 3 ? "ExceedsTransactionLimit" : "VaultInactive";
            setTxLog((prev) => [
              ...prev,
              { instruction: "agent_spend", status: "error", sig: fakeSig(), detail: "Transaction reverted", error: errorName },
            ]);
          }
        }, totalCheckTime)
      );
    }, 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      checkTimers.forEach(clearTimeout);
    };
  }, [activeStep]);

  // Auto-advance
  useEffect(() => {
    if (isPaused || phase !== "result") return;
    const delay = activeStep === 4 ? 8000 : 5000;
    const t = setTimeout(() => {
      const next = (activeStep + 1) % STEPS.length;
      goToStep(next);
    }, delay);
    return () => clearTimeout(t);
  }, [activeStep, isPaused, phase, goToStep]);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        {/* Hero */}
        <div className="text-center">
          <div className="chip mx-auto mb-5">Interactive Demo</div>
          <h1 className="font-display text-5xl font-medium tracking-[-0.04em] md:text-7xl">
            See the protocol <span className="italic text-[var(--accent-deep)]">in action</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-[var(--ink-soft)]">
            Watch the full vault lifecycle — create, spend, enforce, revoke. No wallet needed.
          </p>
        </div>

        {/* Main demo area */}
        <div className="mt-16 grid grid-cols-1 items-start gap-12 md:grid-cols-2 md:gap-16">
          {/* Left: step list */}
          <div className="order-2 md:order-1">
            <div className="flex flex-col gap-1">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goToStep(i)}
                  className={`group flex items-start gap-4 rounded-2xl px-5 py-4 text-left transition ${
                    i === activeStep
                      ? "bg-[var(--bg-elevated)] border border-[var(--ink)] shadow-sm"
                      : "border border-transparent hover:bg-[var(--bg-elevated)] hover:border-[var(--hairline)]"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold transition ${
                      i === activeStep
                        ? "bg-[var(--accent)] text-[var(--ink)]"
                        : i < activeStep
                          ? "bg-[var(--ink)] text-[var(--bg-elevated)]"
                          : "bg-[var(--surface)] text-[var(--ink-soft)]"
                    }`}
                  >
                    {i < activeStep ? "✓" : String(i + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div
                      className={`text-base font-semibold tracking-tight ${
                        i === activeStep ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"
                      }`}
                    >
                      {s.label}
                    </div>
                    {i === activeStep && (
                      <div className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">
                        {s.caption}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Controls */}
            <div className="mt-8 flex items-center gap-4 px-5">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="rounded-full border border-[var(--hairline-strong)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold transition hover:border-[var(--ink)]"
              >
                {isPaused ? "▶ Play" : "❚❚ Pause"}
              </button>
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToStep(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === activeStep
                        ? "w-6 bg-[var(--accent)]"
                        : "w-1.5 bg-[var(--hairline-strong)] hover:bg-[var(--ink-soft)]"
                    }`}
                  />
                ))}
              </div>
              <div className="ml-auto text-xs tabular text-[var(--ink-faint)]">
                {activeStep + 1} / {STEPS.length}
              </div>
            </div>
          </div>

          {/* Right: Vault Console */}
          <div className="order-1 md:order-2 md:sticky md:top-28">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e1621] shadow-lg">
              {/* Console header */}
              <div className="flex items-center justify-between border-b border-white/5 bg-[#17212b] px-5 py-3">
                <span className="font-mono text-[11px] font-semibold text-white/80">Agent Vault Protocol</span>
                <span className="flex items-center gap-1.5 text-[10px] text-white/40">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                  Devnet
                </span>
              </div>

              {/* Vault state card */}
              <div className="border-b border-white/5 px-5 py-4">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Vault State</div>
                {vault.exists ? (
                  <div className="space-y-1 font-mono text-[11px] leading-relaxed">
                    <Row label="Owner" value={OWNER_KEY} />
                    <Row label="Agent" value={AGENT_KEY} />
                    <Row label="PDA" value={VAULT_PDA} />
                    <Row label="Balance" value={`◎ ${vault.balance.toFixed(3)} SOL`} accent />
                    <Row label="Spent" value={`◎ ${vault.spentToday.toFixed(3)} / ${vault.dailyLimit.toFixed(1)} daily`} />
                    <Row label="Per-tx" value={`◎ ${vault.spendLimit.toFixed(1)} max`} />
                    <Row label="Session" value="23h 59m remaining" />
                    <div className="flex justify-between">
                      <span className="text-white/40">Status</span>
                      <span className={`font-semibold ${vault.isActive ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                        {vault.isActive ? "● ACTIVE" : "● REVOKED"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center font-mono text-[11px] text-white/20">
                    No vault created yet
                  </div>
                )}
              </div>

              {/* Security checks (only for spend steps) */}
              {(activeStep === 1 || activeStep === 2) && phase !== "init" && (
                <div className="border-b border-white/5 px-5 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Security Checks</span>
                    <span className="font-mono text-[10px] text-[var(--accent)]">agent_spend()</span>
                  </div>
                  <div className="space-y-1.5">
                    {SECURITY_LAYERS.map((layer, i) => (
                      <div
                        key={layer.id}
                        className={`flex items-center gap-2.5 font-mono text-[11px] transition-all duration-300 ${
                          checks[i] === "pass" ? "text-[#22c55e]"
                          : checks[i] === "fail" ? "text-[#ef4444] vault-shake"
                          : checks[i] === "checking" ? "text-[var(--accent)]"
                          : checks[i] === "skipped" ? "text-white/15"
                          : "text-white/25"
                        }`}
                      >
                        <span className="w-4 text-center">
                          {checks[i] === "pass" ? "✓" : checks[i] === "fail" ? "✗" : checks[i] === "checking" ? "◌" : checks[i] === "skipped" ? "·" : "·"}
                        </span>
                        <span>{layer.id}. {layer.label}</span>
                        {checks[i] === "fail" && activeStep === 2 && i === 3 && (
                          <span className="ml-auto text-[10px] text-[#ef4444]">0.6 &gt; 0.5 SOL</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaction result */}
              <div className="px-5 py-4">
                {phase === "init" && (
                  <div className="py-3 text-center font-mono text-[11px] text-white/20">
                    Waiting...
                  </div>
                )}
                {phase === "signing" && (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
                    <span className="font-mono text-[11px] text-[var(--accent)]">Signing transaction...</span>
                  </div>
                )}
                {phase === "checking" && (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
                    <span className="font-mono text-[11px] text-[var(--accent)]">Verifying on-chain...</span>
                  </div>
                )}
                {phase === "result" && activeStep < 4 && txLog.length > 0 && (
                  <div className="space-y-1">
                    {(() => {
                      const last = txLog[txLog.length - 1];
                      return (
                        <>
                          <div className={`font-mono text-[12px] font-bold ${last.status === "success" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {last.status === "success" ? "✓ CONFIRMED" : "✗ REVERTED"}
                          </div>
                          <div className="font-mono text-[11px] text-white/50">
                            {last.detail}
                          </div>
                          {last.error && (
                            <div className="mt-1 rounded bg-[#ef4444]/10 px-2 py-1 font-mono text-[11px] text-[#ef4444]">
                              Error: {last.error}
                            </div>
                          )}
                          {last.amount && (
                            <div className="font-mono text-[11px] text-[var(--accent)]">{last.amount}</div>
                          )}
                          <div className="font-mono text-[10px] text-white/25">
                            sig: {last.sig}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Summary step: full tx log */}
                {activeStep === 4 && (
                  <div className="space-y-3">
                    <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Transaction Log</div>
                    {txLog.map((tx, i) => (
                      <div key={i} className="border-l-2 pl-3" style={{ borderColor: tx.status === "success" ? "#22c55e" : "#ef4444" }}>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-[11px] font-semibold ${tx.status === "success" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {tx.status === "success" ? "✓" : "✗"}
                          </span>
                          <span className="font-mono text-[11px] text-white/70">{tx.instruction}</span>
                        </div>
                        <div className="font-mono text-[10px] text-white/40">{tx.detail}</div>
                        {tx.error && <div className="font-mono text-[10px] text-[#ef4444]">{tx.error}</div>}
                        {tx.amount && <div className="font-mono text-[10px] text-[var(--accent)]">{tx.amount}</div>}
                      </div>
                    ))}
                    {txLog.length > 0 && (
                      <div className="mt-4 rounded-lg bg-white/5 p-3 text-center">
                        <div className="font-mono text-[11px] text-white/50">
                          {txLog.filter((t) => t.status === "success").length} confirmed · {txLog.filter((t) => t.status === "error").length} reverted · All enforced on-chain
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="relative mt-24 overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--ink)] p-10 text-center text-white md:p-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[var(--accent)]/20 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-3xl font-medium tracking-[-0.03em] md:text-5xl">
              Ready to <span className="italic text-[var(--accent)]">build</span>?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-white/70">
              17 instructions. SOL + SPL tokens. CPI composable. 53 tests passing.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/vault" className="btn-accent text-lg">
                Explore the protocol <span aria-hidden>→</span>
              </Link>
              <a href="https://github.com/magpiecapital/magpie-bot" target="_blank" rel="noopener noreferrer" className="btn-ghost text-lg !text-white !border-white/20 hover:!border-white/50">
                View on GitHub <span aria-hidden>���</span>
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-[var(--hairline)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <Wordmark size={22} />
          <div className="flex items-center gap-8 text-sm text-[var(--ink-soft)]">
            <Link href="/" className="transition hover:text-[var(--ink)]">Home</Link>
            <Link href="/vault" className="transition hover:text-[var(--ink)]">Vault</Link>
            <Link href="/docs" className="transition hover:text-[var(--ink)]">Docs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/40">{label}</span>
      <span className={accent ? "text-[var(--accent)] font-semibold" : "text-white/70"}>{value}</span>
    </div>
  );
}
