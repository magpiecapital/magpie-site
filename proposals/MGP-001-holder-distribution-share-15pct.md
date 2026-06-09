---
id: MGP-001
title: Restructure the loan-fee split — 60% to $MAGPIE holders, 30% to SOL LPs (5% referrer / 2% LP loyalty / 3% protocol unchanged)
scope_tier: A4 — binding by operator commitment (one-time Tier B → de-facto Tier A exception, same path as MGP-003)
status: active
voting_window: 2026-06-09 to 2026-06-12 (3 days)
author: "@MagpieLoans"
created_at: 2026-06-09
activated_at: 2026-06-09
rescoped_at: 2026-06-09
---

# MGP-001 — Restructure the loan-fee split to 60% holders / 30% LPs

## 1. Summary

This proposal changes the share of every loan fee that accrues to $MAGPIE holders from **10% to 60%**. The 50-percentage-point increase comes from the SOL LP share, which decreases from **80% to 30%**. All other splits (referrer 5%, LP loyalty 2%, protocol 3%) remain unchanged.

The change applies to future loans originated after the execution timestamp. Distributions already accrued or in flight at the time of execution are unaffected — the change cannot reach backward into existing loans.

**Note on rescope.** This proposal originally targeted a 10% → 15% incremental step (the upper bound of Tier A4) as the first move in a longer arc toward the 60/30 target. On 2026-06-09 during the activation window, the operator rescoped MGP-001 to put the full target on the ballot directly. The 60% holder share is materially outside the Tier A4 5%–15% bound, so this proposal is filed as a one-time Tier B → de-facto Tier A exception under operator commitment, using the same path documented in MGP-003. Holders may vote YES on the direct 60/30 move, NO to keep the current 80/10 split, or ABSTAIN to defer to operator discretion.

## 2. Background

The current fee split is set in code via four constants and one configurable pool parameter:

| Recipient | Constant | Code path | BPS | % of fee |
|---|---|---|---:|---:|
| **SOL LPs** | (derived) | `magpie-bot/src/api/server.js:796` | 8,000 | 80.0% |
| **$MAGPIE holders** | `HOLDER_REWARD_BPS` | `magpie-bot/src/services/magpie-holder-rewards.js:43` | 1,000 | 10.0% |
| **Referrers** | `REFERRAL_REWARD_BPS` | `magpie-bot/src/services/referral-rewards.js:30` | 500 | 5.0% |
| **LP loyalty pool** | `LP_LOYALTY_REWARD_BPS` | `magpie-bot/src/services/lp-loyalty.js:34` | 200 | 2.0% |
| **Protocol** | `protocolFeeBps` (on-chain pool config) | `magpie-bot/src/api/server.js:795` | 300 | 3.0% |
| **Total** | | | 10,000 | 100.0% |

The LP share is computed as the residual: `lp_fee_share_bps = 10_000 − (holder + referrer + loyalty + protocol)`. Changing any other constant automatically changes the LP share by the same amount; this is the mechanism this proposal uses to reduce the LP share by 50 pp.

The 10% holder / 80% LP split has been in effect since the $MAGPIE token launched in March 2026. The protocol has originated 450+ loans across 2,700+ unique wallets, with sub-1.5% lifetime liquidation rate — verifiable at [magpie.capital/api/v1/stats](https://www.magpie.capital/api/v1/stats).

## 3. Proposed change

Change `HOLDER_REWARD_BPS` from `1_000` (10%) to `6_000` (60%) in [`magpie-bot/src/services/magpie-holder-rewards.js`](https://github.com/magpiecapital/magpie-bot/blob/main/src/services/magpie-holder-rewards.js#L43).

No other constants change. The implicit LP share recomputes as `10_000 − (6_000 + 500 + 200 + 300) = 3_000` BPS = **30.0%**.

The resulting split:

| Recipient | Before | After | Change |
|---|---:|---:|---:|
| SOL LPs | 80.0% | 30.0% | **−50.0 pp** |
| $MAGPIE holders | 10.0% | 60.0% | **+50.0 pp** |
| Referrers | 5.0% | 5.0% | — |
| LP loyalty | 2.0% | 2.0% | — |
| Protocol | 3.0% | 3.0% | — |

**Tier A4 bound exception:** the holder share at 60% is well outside the Tier A4 5%–15% bound documented in [GOVERNANCE.md](../GOVERNANCE.md). This proposal sidesteps the formal Tier C escalation process (which would require an 80% pass + 15% quorum + 30-day cooling-off) by routing through the same one-time Tier B → de-facto Tier A operator-commitment path used by MGP-003. The operator commits in this proposal text to honor the winning outcome.

## 4. Rationale

This is the protocol's stated long-term holder-LP economics in a single step rather than over a sequence of A4-bounded amendments. The arc was previously documented in earlier drafts of this proposal as a multi-step path; the rescope consolidates that arc into one decision so holders vote on the target directly.

Three reasons.

**Token-holder alignment as a first-class economic claim.** At 60%, $MAGPIE holders capture the plurality of protocol fees in SOL. That makes the token a direct cash-flow claim on protocol activity, not just a governance + bonus-yield instrument. The signal to existing and prospective holders is unambiguous: holding $MAGPIE is the economic right to the majority of fee output.

**LPs still get the operationally-required share.** At 30%, SOL LPs still receive 6× what the protocol receives (3%), 6× what referrers receive (5%), and 15× what LP loyalty receives (2%). 30% is meaningful capital compensation for SOL exposure to liquidation risk. It is materially lower than the current 80%, and LP capital will respond — see §6 on risks.

**Stop fragmenting the same decision across multiple votes.** A phased plan (15% → 30% → 45% → 60%) over four sequential proposals would mean four governance cycles, four execution windows, and four chances for the protocol's positioning to drift. Putting the target on the ballot directly tests the community's appetite for the end state once, not four times.

## 5. Economic impact

The protocol distributes fees from gross loan fees. Worked numbers from live protocol activity:

- Lifetime borrowed: ~500 SOL (live: `/api/v1/stats.totalSolLent`)
- Average fee rate across tiers: ~2.1% (weighted by tier mix: Express 63%, Standard 24%, Quick 13%)
- Estimated lifetime gross fees: ~10.5 SOL

At the **current** 10% / 80% split:

| Recipient | Lifetime SOL |
|---|---:|
| SOL LPs (80%) | ~8.4 SOL |
| $MAGPIE holders (10%) | ~1.05 SOL |
| Referrers (5%) | ~0.53 SOL |
| LP loyalty (2%) | ~0.21 SOL |
| Protocol (3%) | ~0.32 SOL |

At the **proposed** 60% / 30% split, on the same lifetime fee base:

| Recipient | Lifetime SOL | Δ vs current |
|---|---:|---:|
| SOL LPs (30%) | ~3.15 SOL | **−5.25 SOL** |
| $MAGPIE holders (60%) | ~6.30 SOL | **+5.25 SOL** |
| Referrers (5%) | ~0.53 SOL | — |
| LP loyalty (2%) | ~0.21 SOL | — |
| Protocol (3%) | ~0.32 SOL | — |

These are retrospective figures for context only — the change is forward-only. The live fee run-rate is published at `/api/v1/stats.totalFeesEarnedLamports` and refreshes per request.

Per-holder impact at scale: a holder owning 1% of circulating $MAGPIE supply receives ~1% of the 60% share, which is **6× more SOL per loan-fee dollar than today**. Per-LP impact: an LP with 5% of vault share goes from earning ~5% × 80% = 4% of every loan fee to earning 5% × 30% = 1.5%. **62.5% reduction in LP yield per SOL deposited.**

## 6. Risks

These are larger than under the prior 10% → 15% scope and need to be looked at directly.

1. **LP withdrawal cliff.** A 62.5% reduction in LP yield per SOL deposited is a strong signal for LPs to withdraw. Some LPs are likely yield-elastic and will reallocate to higher-yielding venues. If the protocol's borrow demand exceeds the new LP capacity, available liquidity tightens and borrows get refused. Mitigation paths if observed: raise loan fees (a subsequent A3 proposal) to restore LP APR, or add a time-boxed "LP migration bonus" funded from protocol take.

2. **Borrowing volume sensitivity.** If LP liquidity tightens AND fees rise to compensate, borrow demand may fall. Reduced borrows → reduced gross fees → smaller absolute distributions to all recipients, including holders. The 60% share is meaningful only if the absolute fee base holds up. A protocol that pays holders 60% of $1 is worse for holders than one that pays them 10% of $20.

3. **One-shot vs phased information loss.** A phased plan (15% → 30% → 45% → 60%) would have given the operator LP-response data at each step before committing to the next. The one-shot move locks in the end state without that data; if 60% turns out to be too aggressive, the rollback to a smaller holder share requires its own proposal cycle (the 14-day execution window is forward-only).

4. **Governance precedent.** Using the Tier B → de-facto Tier A path for a 50-pp change (as opposed to MGP-003's allocation-decision use of the same path) expands the de facto scope of governance significantly. Mitigation: §1 documents this as a one-time exception, explicitly limiting the precedent.

5. **Signal risk on the LP side.** Reducing the LP share by ⅝ — even if defensible — may be read by potential institutional or large LPs as the protocol pricing out lender capital as a stakeholder. Counter-evidence: 30% is still the second-largest single share and 6× what the protocol itself takes.

6. **Implementation drift.** The change touches a single BPS constant. Misconfiguration (changing the wrong constant, partial deployment) would produce an incorrect split. Mitigation: the executing commit must include a regression test verifying the new BPS values sum to 10_000.

7. **Treatment of in-flight loans.** The execution must explicitly affect only loans originated after the timestamp. If the code path is incorrectly modified to backfill distributions on existing loans, the proposal's commitment ("future loans only") is violated.

## 7. Dissent paths

Reasons a holder might legitimately vote NO:

- **Wrong magnitude.** Even if 60% is the right end state, jumping there in one move is risky. A phased path (e.g. 30% first, observe LP behavior, then 60% if conditions support it) preserves optionality. Vote NO if you want phasing.
- **Timing is wrong.** The protocol is currently shipping new product surface (Premium tier in MGP-002, Streamflow allocation decision in MGP-003). Stacking a 50-pp fee restructure on top of those concurrent changes is operationally aggressive. Holding the fee split stable during the current multi-proposal cycle is a defensible position.
- **LP-first dissent.** Vote NO if you believe SOL LPs are the binding constraint on the protocol's growth. Without them there is no SOL to lend; without lent SOL there are no fees; without fees there is no holder distribution. A protocol that pays holders 60% of nothing is not better for holders.
- **Governance procedure objection.** Vote NO if you believe major scope-tier exceptions should always go through the formal Tier C process (80% pass / 15% quorum / 30-day cooling-off) and not via operator-committed Tier B → de-facto Tier A shortcuts.

Vote ABSTAIN if you want the operator to use discretion on this decision instead of binding it via governance.

## 8. Verification

- **Vote weight basis:** voting weight per wallet equals the wallet's $MAGPIE balance at the time of proposal activation, with the exclusion list in [`GOVERNANCE.md`](../GOVERNANCE.md#voting-power) applied. The activation-time holder balance set and per-wallet voting weights are operator-internal in v0; they are not published.
- **Vote payloads:** each YES / NO / ABSTAIN is a wallet-signed structured message identifying the proposal ID and the vote. The operator records signed payloads to maintain the audit trail.
- **Aggregate publication:** at vote close, the operator publishes the aggregate YES weight, NO weight, ABSTAIN weight, eligible-supply total, quorum met / not met, and pass / fail result. Per-wallet vote choices are not published.
- **Quorum:** ≥ 5% of eligible supply must cast YES + NO (ABSTAIN does not count toward quorum).
- **Pass threshold:** ≥ 60% of (YES + NO) must be YES. (Standard Tier A threshold, applied here under the operator-commitment exception in §1.)
- **Operator-trust note:** v0 verification is operator-trust-based by design. v1 and v2 progressively move verification on-chain. The trust model evolves with the model version, not within v0.

## 9. Execution plan

If passed, the operator will, within 14 days of vote close:

1. Open a PR against `magpie-bot/main` titled `governance: MGP-001 holder share 10% → 60%`.
2. The PR modifies exactly one line: `magpie-bot/src/services/magpie-holder-rewards.js:43` from `export const HOLDER_REWARD_BPS = 1_000;` to `export const HOLDER_REWARD_BPS = 6_000;`.
3. Add a regression test asserting that `HOLDER_REWARD_BPS + REFERRAL_REWARD_BPS + LP_LOYALTY_REWARD_BPS + DEFAULT_PROTOCOL_FEE_BPS + LP_FEE_SHARE_BPS === 10_000`.
4. Update `community-pip.js` and `ai-support.js` system-prompt mentions of the fee split from `80% / 10% / 5% / 2% / 3%` to `30% / 60% / 5% / 2% / 3%`. Failure to update Pip's prompts will result in Pip giving outdated answers to community members.
5. Update `magpie-site/src/app/tokenomics/page.tsx`, `/magpie/page.tsx`, `/api/v1/info`, and any /docs / /whitepaper mention of the 80/10 figures.
6. Commit message references "MGP-001" so future audits can trace the change.
7. Tag the deploy timestamp; the change applies to loans with `start_timestamp_unix >= deploy_timestamp_unix`.
8. Publish a public statement in @magpietalk and on @MagpieLoans describing the change as live, with the deploy commit SHA + timestamp.

Existing active loans accrue distributions at the previous 10% rate through their natural close. Distributions already paid to holder wallets are not clawed back.

## 10. How to vote

- On-site: connect your wallet at **https://www.magpie.capital/governance/proposal/MGP-001** and click YES / NO / ABSTAIN. The wallet asks you to sign a small JSON payload — no SOL moves, no gas.
- Alternative: post your intent in [@magpietalk](https://t.me/magpietalk) — format `MGP-001 vote · YES` (or NO / ABSTAIN). The operator folds @magpietalk intents into the tally at close.

You can change your vote any time before the voting window closes; the latest valid signature wins.

## 11. Lifecycle

- `2026-06-09` — drafted by @MagpieLoans (initial 10→15% incremental version)
- `2026-06-09` — operator scope review passed; status → `active`; 3-day voting window opens (closes 2026-06-12)
- `2026-06-09` — proposal rescoped during activation window from 10→15% incremental to the full 10→60% target. Voting window unchanged. Existing intent registered in @magpietalk before the rescope is invalidated; voters are asked to recast.
- (target 2026-06-12) — status → `closed`, tally computed
- (target 2026-06-15 to 2026-06-26) — status → `executed` (passing) or `failed`
- (T+30 days post-execution) — retrospective: observed LP TVL response, borrow volume response, and holder retention vs projected effects, appended below
