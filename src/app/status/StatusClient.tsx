"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface Heartbeat {
  lastCycleAt?: string;
  ageMs?: number;
  ok?: boolean;
}

interface HealthPayload {
  status: "ok" | "degraded" | string;
  service: string;
  checks: Record<string, string>;
  reasons?: string[];
  uptimeMs?: number;
  startedAt?: string;
  heartbeats?: Record<string, Heartbeat>;
}

function fmtDuration(ms: number | undefined): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function checkColor(status: string): string {
  if (status === "ok") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (status === "warming-up") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  if (status === "stale") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  if (status === "fail") return "border-red-500/40 bg-red-500/10 text-red-300";
  return "border-white/20 bg-white/5 text-white/60";
}

export default function StatusClient() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    const botApi = process.env.NEXT_PUBLIC_BOT_API_URL || "";
    if (!botApi) {
      setError("Status unavailable — bot API not configured");
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(`${botApi}/api/v1/health`);
        const j = await r.json();
        if (cancelled) return;
        setData(j);
        setFetchedAt(new Date());
        // HTTP 503 still returns a body; we want to render whichever
        // checks are available, so don't throw on non-200.
        if (!r.ok && r.status !== 503) {
          setError(`HTTP ${r.status}`);
        } else {
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    const id = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const overall = data?.status === "ok" ? "All systems operational" : data?.status === "degraded" ? "Degraded" : "Unknown";
  const overallColor =
    data?.status === "ok"
      ? "text-emerald-300"
      : data?.status === "degraded"
        ? "text-amber-300"
        : "text-white/60";

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-24">
        <div className="mb-10">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/40">Status</div>
          <h1 className={`mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl ${overallColor}`}>
            {overall}
          </h1>
          <p className="mt-4 max-w-2xl text-sm text-white/60 leading-relaxed">
            Live snapshot of the Magpie bot + API health. Pulls /api/v1/health every 20 seconds.
          </p>
          {fetchedAt && (
            <p className="mt-2 text-[11px] text-white/40">
              Last checked {fetchedAt.toLocaleTimeString()}
              {data?.uptimeMs != null && (
                <> · Uptime {fmtDuration(data.uptimeMs)}</>
              )}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {data ? (
          <div className="space-y-3">
            {Object.entries(data.checks).map(([name, status]) => {
              const hb = data.heartbeats?.[name];
              return (
                <div
                  key={name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{name}</div>
                    {hb?.lastCycleAt && (
                      <div className="mt-0.5 text-[11px] text-white/40">
                        Last cycle: {new Date(hb.lastCycleAt).toLocaleString()}
                        {hb.ageMs != null && <> · {fmtDuration(hb.ageMs)} ago</>}
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${checkColor(status)}`}>
                    {status}
                  </span>
                </div>
              );
            })}

            {data.reasons && data.reasons.length > 0 && (
              <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="text-sm font-semibold text-amber-300">Issues</div>
                <ul className="mt-2 space-y-1 text-xs text-amber-200">
                  {data.reasons.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : !error ? (
          <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-white/50">Loading…</div>
        ) : null}

        <p className="mt-10 text-xs text-white/40">
          If something here is red and you're affected, run /support in @magpie_capital_bot and the team will pick it up immediately.
        </p>
      </main>
      <Footer />
    </div>
  );
}
