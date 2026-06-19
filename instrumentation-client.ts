/**
 * Browser-side Sentry init — runs in the user's browser. Catches
 * client-side errors (React render errors, Phantom wallet exceptions,
 * unhandled promise rejections in browser JS).
 *
 * Symmetric with instrumentation.ts which handles server + edge.
 * Together they give full bot/site coverage of errors.
 *
 * No-op when NEXT_PUBLIC_SENTRY_DSN is unset.
 *
 * Operator-mandated 2026-06-19 PM (Tier B observability decision).
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE) || 0.05,
    // Privacy: redact wallet pubkeys from request URLs before they
    // leave the browser. We have our own user activity in
    // conversion_events; Sentry doesn't need a PII-linked copy.
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/wallet=[A-Za-z0-9]+/g, "wallet=REDACTED");
      }
      return event;
    },
  });
  if (typeof window !== "undefined") {
    console.log("[sentry] browser SDK initialized");
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
