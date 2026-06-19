/**
 * Next.js instrumentation hook — runs once at server startup. We use
 * this to env-gate Sentry initialization. No-op when NEXT_PUBLIC_SENTRY_DSN
 * is unset (operator hasn't signed up yet); operator flips the env on
 * Vercel and next deploy auto-initializes.
 *
 * Operator-mandated 2026-06-19 PM (Tier B observability decision).
 */
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const { initSentryClient } = await import("./src/lib/sentry");
    initSentryClient();
  }
}
