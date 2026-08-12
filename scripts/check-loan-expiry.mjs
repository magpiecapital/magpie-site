#!/usr/bin/env node
/**
 * Guard: loan-expiry warning tiers.
 *
 * For a site-only borrower this notice is the ONLY expiry warning that exists
 * — their stub user row has no Telegram account behind it, so every warning DM
 * fails with `chat not found`. Measured over 90 days: 1 of 72 site-only
 * borrowers reaching the 24h window were warned, versus 68 of 71 on Telegram,
 * and all nine unwarned liquidations were site-only.
 *
 * So the safety-critical direction here is UNDER-warning: a boundary that
 * silently renders nothing, or renders a calm tier when the loan is hours from
 * liquidation. Thresholds must also stay identical to the bot's 24h/6h
 * checkpoints so the dashboard and the DM can never contradict each other.
 *
 * Run: npm run check:loan-expiry
 */
import {
  computeExpiryUrgency,
  shouldWarn,
  fmtDuration,
} from "../src/lib/loan-expiry.ts";

let failures = 0;
const ok = (n) => console.log(`  ✅ ${n}`);
const bad = (n, d) => { failures++; console.error(`  ❌ ${n}${d ? ` — ${d}` : ""}`); };
const expect = (n, a, w) => (a === w ? ok(n) : bad(n, `got ${JSON.stringify(a)}, wanted ${JSON.stringify(w)}`));

const NOW = 1_700_000_000_000;
const at = (hoursFromNow) =>
  computeExpiryUrgency(new Date(NOW + hoursFromNow * 3_600_000).toISOString(), NOW);

console.log("\n== tiers mirror the bot's 24h / 6h checkpoints ==");
expect("72h out → none", at(72).tier, "none");
expect("48h exactly → approaching (inclusive)", at(48).tier, "approaching");
expect("47h → approaching", at(47).tier, "approaching");
expect("24h exactly → urgent (the bot's 1st checkpoint)", at(24).tier, "urgent");
expect("23h → urgent", at(23).tier, "urgent");
expect("6h exactly → critical (the bot's 2nd checkpoint)", at(6).tier, "critical");
expect("5h → critical", at(5).tier, "critical");
expect("1 minute left → critical, still not overdue", at(1 / 60).tier, "critical");
expect("exactly due → overdue", at(0).tier, "overdue");
expect("1h past → overdue", at(-1).tier, "overdue");

console.log("\n== the two live at-risk loans are actually covered ==");
// These are real: both site-only, both unreachable on Telegram.
expect("loan due in 31h shows a warning", shouldWarn(at(31).tier), true);
expect("loan due in 47h shows a warning", shouldWarn(at(47).tier), true);

console.log("\n== never silently render nothing when time is short ==");
for (const h of [47.9, 24.1, 24, 12, 6.1, 6, 3, 0.5, 0.01, 0, -0.5, -100]) {
  const t = at(h).tier;
  if (t === "unknown" || t === "none") bad(`${h}h → ${t} (borrower would see NOTHING)`);
  else if (!shouldWarn(t)) bad(`${h}h → ${t} not warned`);
}
ok("every point inside 48h through overdue produces a visible warning");

console.log("\n== malformed input degrades quietly, never throws ==");
for (const junk of [null, undefined, "", "not a date", NaN, 42, {}, [], "0000-00-00"]) {
  let r;
  try { r = computeExpiryUrgency(junk, NOW); }
  catch (e) { bad(`threw on ${JSON.stringify(junk)}`, e.message); continue; }
  if (r.tier !== "unknown") bad(`${JSON.stringify(junk)} → ${r.tier}`, "wanted unknown");
}
ok("all malformed inputs → unknown, nothing thrown");
expect("unknown is not warned on", shouldWarn("unknown"), false);
expect("none is not warned on", shouldWarn("none"), false);

console.log("\n== duration never overstates the time remaining ==");
expect("90 minutes", fmtDuration(90 * 60_000), "1h 30m");
expect("exactly 2h", fmtDuration(2 * 3_600_000), "2h");
expect("59 minutes", fmtDuration(59 * 60_000), "59 minutes");
expect("1 minute singular", fmtDuration(60_000), "1 minute");
expect("sub-minute", fmtDuration(30_000), "less than a minute");
expect("36h → 1d 12h", fmtDuration(36 * 3_600_000), "1d 12h");
expect("30 days", fmtDuration(30 * 86_400_000), "30 days");
expect("overdue uses magnitude", fmtDuration(-2 * 3_600_000), "2h");
// Rounding DOWN matters: 5h59m must never read as "6h".
expect("5h59m rounds down", fmtDuration((5 * 60 + 59) * 60_000), "5h 59m");

console.log(
  failures === 0 ? "\n✅ loan-expiry guard passed\n" : `\n❌ ${failures} check(s) failed\n`,
);
process.exit(failures === 0 ? 0 : 1);
