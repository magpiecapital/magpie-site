#!/usr/bin/env node
/**
 * Behavioural guard for the per-IP limiter on the RPC-spending routes.
 *
 * The dangerous failure here is NOT "an attacker got through" — it is "a real
 * borrower got blocked". The protocol's first mandate is that every loan and
 * every repayment executes, so the fail-open properties below matter more than
 * the blocking one, and are tested first.
 */
import { rateLimit, clientIp } from "../src/lib/rate-limit.ts";

let failed = 0;
const check = (name, cond) => {
  if (!cond) { failed++; console.error(`✕ ${name}`); } else { console.log(`✓ ${name}`); }
};
const reqWith = (ip) => new Request("https://x/y", { headers: ip ? { "x-forwarded-for": ip } : {} });

// ── fail-open properties (the ones that protect real users) ────────────────
check("no IP header → allowed (unattributable must never block)",
  rateLimit(reqWith(null), "t_noip", 1).limited === false);
{
  let blocked = 0;
  for (let i = 0; i < 50; i++) if (rateLimit(reqWith(null), "t_noip2", 1).limited) blocked++;
  check("50 requests with no IP → none blocked", blocked === 0);
}
check("a malformed request object fails open, does not throw",
  rateLimit({}, "t_bad", 1).limited === false);

// ── the limit itself ───────────────────────────────────────────────────────
{
  const ip = "203.0.113.9";
  let allowed = 0;
  for (let i = 0; i < 30; i++) if (!rateLimit(reqWith(ip), "t_cap", 30).limited) allowed++;
  check("exactly the first 30 of 30 are allowed", allowed === 30);
  const over = rateLimit(reqWith(ip), "t_cap", 30);
  check("the 31st is limited", over.limited === true);
  check("429 carries a positive retry-after", over.retryAfter > 0);
}

// ── isolation: one abuser must not affect anyone else ──────────────────────
{
  const scope = "t_iso";
  for (let i = 0; i < 40; i++) rateLimit(reqWith("198.51.100.1"), scope, 30);
  check("a different IP is unaffected by the abuser",
    rateLimit(reqWith("198.51.100.2"), scope, 30).limited === false);
  check("the same IP on a DIFFERENT route is unaffected",
    rateLimit(reqWith("198.51.100.1"), "t_iso_other", 30).limited === false);
}

// ── window expiry ──────────────────────────────────────────────────────────
{
  const ip = "203.0.113.77";
  rateLimit(reqWith(ip), "t_win", 1, 1); // 1ms window
  const start = Date.now();
  while (Date.now() - start < 5) { /* let the window lapse */ }
  check("the window resets and the caller is allowed again",
    rateLimit(reqWith(ip), "t_win", 1, 1).limited === false);
}

// ── x-forwarded-for parsing ────────────────────────────────────────────────
check("left-most XFF entry is used as the client",
  clientIp(new Request("https://x/y", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } })) === "9.9.9.9");

if (failed) { console.error(`\n[rate-limit] ${failed} check(s) failed.`); process.exit(1); }
console.log("\n[rate-limit] OK — limiter bounds abuse and never blocks an unattributable or unrelated caller.");
