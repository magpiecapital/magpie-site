#!/usr/bin/env node
/**
 * Behavioural guard for the collectible vetting gate.
 *
 * This gate decides what may become loan collateral. A silent regression here
 * — a loosened grade floor, an exclusion that stops matching, autographs
 * drifting into the top tier — would not fail a build or a type check; it
 * would just quietly start saying yes to things it must say no to.
 *
 * So the cases below are not illustrative. Each one encodes a rule we decided
 * deliberately (design repo doc 26 V-1..V-7, 26.9), and a failure here means
 * either a real regression or a deliberate policy change that must also be
 * reflected in doc 26 and in Pip's knowledge.
 *
 * Zero dependencies by design — Node runs the TypeScript directly, matching
 * the bot's lightweight guard scripts (syntax-check, ltv-guard, migration-lint).
 *
 * Usage: node --experimental-strip-types scripts/check-collectible-gate.mjs
 * Exit:  0 clean · 1 a rule regressed
 */
import { vetSubmission } from "../src/lib/collectible-vetting.ts";

const VAULT = "Collector Crypt";
const base = { grader: "PSA", cert: "26573583", platform: VAULT };

const CASES = [
  // ── The book must still open for what qualifies ──
  {
    why: "Tier A blue-chip, numerically graded, vaulted",
    sub: { ...base, card: "Base Set Charizard #4 Shadowless", grade: "10" },
    verdict: "PROVISIONAL_TIER_A",
    tier: "A",
  },
  {
    why: "Tier B holo rare",
    sub: { ...base, card: "Base Set Zapdos #16", grade: "9" },
    verdict: "PROVISIONAL_TIER_B",
    tier: "B",
  },
  {
    why: "grade 8 is the floor, not below it",
    sub: { ...base, card: "Base Set Charizard #4", grade: "8" },
    verdict: "PROVISIONAL_TIER_A",
  },

  // ── Autographs: accepted, but never at the top tier (doc 26.9) ──
  {
    why: "authenticated auto of an iconic rookie lands at Tier B",
    sub: { ...base, card: "2009 Topps Stephen Curry #321 rookie", autoGrade: "10" },
    verdict: "PROVISIONAL_TIER_B",
    tier: "B",
  },
  {
    why: "an auto NEVER reaches Tier A — an Authentic slab has no condition grade",
    sub: { ...base, card: "1986 Fleer Michael Jordan #57", autoGrade: "10" },
    verdict: "PROVISIONAL_TIER_B",
    tier: "B",
  },
  {
    why: "a signature does not create a market — unknown player goes to review",
    sub: { ...base, card: "2019 Topps Journeyman Backup rookie auto", autoGrade: "10" },
    verdict: "CANDIDATE_REVIEW",
    tier: null,
  },
  {
    why: "auto grade below 9 is not enough",
    sub: { ...base, card: "2009 Topps Stephen Curry #321 rookie", autoGrade: "8" },
    verdict: "DECLINED",
  },

  // ── The exclusions that keep illiquid collateral out (doc 26.3) ──
  {
    why: "one-of-a-kind trophy — value is not liquidity",
    sub: { ...base, card: "Pikachu Illustrator promo", grade: "9" },
    verdict: "DECLINED",
  },
  {
    why: "sealed product is reprint- and hype-exposed",
    sub: { ...base, card: "Sealed Base Set booster box", grade: "9" },
    verdict: "DECLINED",
  },
  {
    why: "raw/ungraded has no authentication anchor",
    sub: { ...base, card: "raw Charizard holo", grade: "10" },
    verdict: "DECLINED",
  },
  {
    why: "below grade 8 — comps too thin, spreads too wide",
    sub: { ...base, card: "Base Set Charizard #4", grade: "5" },
    verdict: "DECLINED",
  },
  {
    why: "unrecognised grader is not an authentication anchor",
    sub: { ...base, grader: "MyMate", card: "Base Set Charizard #4", grade: "10" },
    verdict: "DECLINED",
  },
  {
    why: "a cert we can't check is not a cert",
    sub: { ...base, cert: "abc", card: "Base Set Charizard #4", grade: "10" },
    verdict: "DECLINED",
  },

  // ── Custody ──
  {
    why: "eligible card that isn't tokenized yet is redirected, not rejected",
    sub: { grader: "PSA", cert: "26573583", card: "Base Set Charizard #4", grade: "10" },
    verdict: "NEEDS_VAULTING",
  },

  // ── Growth path: unknown but clean must stay reviewable, or the book can't grow ──
  {
    why: "clean card off the list goes to candidate review",
    sub: { ...base, card: "Wugtrio EX Temporal Forces #060", grade: "10" },
    verdict: "CANDIDATE_REVIEW",
    tier: null,
  },
];

let failed = 0;

for (const c of CASES) {
  const got = vetSubmission(c.sub);
  const problems = [];
  if (got.verdict !== c.verdict) {
    problems.push(`verdict ${got.verdict}, expected ${c.verdict}`);
  }
  if ("tier" in c && got.tier !== c.tier) {
    problems.push(`tier ${got.tier}, expected ${c.tier}`);
  }
  if (problems.length) {
    failed++;
    console.error(`✕ ${c.why}\n    ${problems.join("; ")}`);
  }
}

// Invariants that hold for EVERY outcome, not just the cases above.
for (const c of CASES) {
  const got = vetSubmission(c.sub);
  if (/approved/i.test(got.verdict)) {
    failed++;
    console.error(`✕ a verdict claimed approval: ${got.verdict}`);
  }
  // The gate must never emit a price. A dollar figure here would turn an
  // eligibility check into an appraisal (threat model T-22).
  const text = JSON.stringify(got);
  if (/\$\s?\d/.test(text)) {
    failed++;
    console.error(`✕ a verdict emitted a dollar value: ${c.why}`);
  }
}

if (failed) {
  console.error(
    `\n[collectible-gate] ${failed} rule(s) regressed.\n` +
      "If this was deliberate, update design repo doc 26 and Pip's knowledge in the same change.",
  );
  process.exit(1);
}

console.log(`[collectible-gate] OK — ${CASES.length} rules hold.`);
