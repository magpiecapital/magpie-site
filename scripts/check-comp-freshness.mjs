#!/usr/bin/env node
/**
 * Advisory freshness check for collectible comp estimates. The UI stale-
 * guards at 45 days (numbers auto-hide) — this surfaces the runway so the
 * refresh (scripts/collectibles-pipeline/README.md) happens BEFORE that.
 * Exit 0 always: freshness must never block a deploy; the UI degrades safely.
 */
import { readFileSync } from "node:fs";

const FILES = [
  "src/lib/collectibles-catalog.ts",
  "src/lib/collectibles-catalog-expansion.ts",
  "src/lib/collectibles-catalog-wave2.ts",
  "src/lib/collectibles-catalog-wave3.ts",
];
const MAX_AGE = 45;
let oldest = null;
for (const f of FILES) {
  for (const m of readFileSync(f, "utf8").matchAll(/asOf: "(\d{4}-\d{2}-\d{2})"/g)) {
    if (!oldest || m[1] < oldest) oldest = m[1];
  }
}
if (!oldest) { console.log("[comp-freshness] no dated comps found"); process.exit(0); }
const age = Math.floor((Date.now() - new Date(oldest + "T00:00:00Z")) / 86_400_000);
const left = MAX_AGE - age;
const msg = `[comp-freshness] oldest asOf ${oldest} (${age}d old) — ${left}d until the UI hides estimates`;
if (left <= 0) console.log(`${msg}\n  ⚠️ STALE: estimates are HIDDEN on the site. Run the refresh pipeline now (scripts/collectibles-pipeline/).`);
else if (left <= 10) console.log(`${msg}\n  ⚠️ Refresh soon: scripts/collectibles-pipeline/README.md`);
else console.log(msg);
