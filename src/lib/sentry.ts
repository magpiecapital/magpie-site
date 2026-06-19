/**
 * Sentry stub — env-gated, no-op when NEXT_PUBLIC_SENTRY_DSN is unset.
 *
 * To enable in production:
 *   1. Sign up at sentry.io ($26/mo Team plan)
 *   2. Create a Next.js project
 *   3. Set NEXT_PUBLIC_SENTRY_DSN env var on Vercel
 *   4. Next build picks it up automatically
 *
 * Operator-mandated 2026-06-19 PM (Tier B observability decision):
 * Sentry kept ($26/mo), Better Stack skipped (canary covers), Triton
 * deferred 7 days pending canary data on actual RPC fail rate.
 *
 * @sentry/nextjs handles client + server + edge runtimes automatically
 * when initialized via instrumentation.ts. This module is the env-gated
 * wrapper around it.
 */
import * as SentryReal from "@sentry/nextjs";

let _initialized = false;

export function initSentryClient(): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (typeof window !== "undefined") {
      console.log("[sentry] disabled — NEXT_PUBLIC_SENTRY_DSN unset (stub mode)");
    }
    return;
  }
  if (_initialized) return;
  try {
    SentryReal.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || "production",
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE) || 0.05,
      // Privacy: redact wallet pubkeys from request URLs. We already
      // have user activity in our own telemetry; Sentry doesn't need
      // a duplicate copy with PII linkage potential.
      beforeSend(event) {
        if (event.request?.url) {
          event.request.url = event.request.url.replace(/wallet=[A-Za-z0-9]+/g, "wallet=REDACTED");
        }
        return event;
      },
    });
    _initialized = true;
    console.log(`[sentry] initialized — environment=${process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production"}`);
  } catch (e) {
    console.warn(`[sentry] init failed: ${(e as Error).message?.slice(0, 120)}`);
  }
}

/**
 * Capture an exception. No-op if Sentry isn't initialized.
 */
export function captureException(err: unknown, ctx: Record<string, unknown> = {}): void {
  if (!_initialized) return;
  try {
    SentryReal.captureException(err, { extra: ctx });
  } catch { /* swallow */ }
}

/**
 * Capture a structured message. No-op if Sentry isn't initialized.
 */
export function captureMessage(msg: string, ctx: Record<string, unknown> & { level?: SentryReal.SeverityLevel } = {}): void {
  if (!_initialized) return;
  try {
    SentryReal.captureMessage(msg, { extra: ctx, level: ctx.level || "info" });
  } catch { /* swallow */ }
}

export function isInitialized(): boolean {
  return _initialized;
}
