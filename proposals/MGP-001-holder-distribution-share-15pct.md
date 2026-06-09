---
id: MGP-001
title: Increase $MAGPIE holder fee share from 10% to 15%, with the increase coming from the LP share
scope_tier: A4
status: active
voting_window: 2026-06-09 to 2026-06-12 (3 days)
author: "@MagpieLoans"
created_at: 2026-06-09
activated_at: 2026-06-09
---

# MGP-001 — Increase $MAGPIE holder fee share from 10% to 15%

## 1. Summary

This proposal changes the share of every loan fee that accrues to $MAGPIE holders from **10% to 15%**. The 5-percentage-point increase comes from the SOL LP share, which decreases from **80% to 75%**. All other splits (referrer 5%, LP loyalty 2%, protocol 3%) remain unchanged.

The change applies to future loans originated after the execution timestamp. Distributions already accrued or in flight at the time of execution are unaffected — the change cannot reach backward into existing loans.

## 2. Background

The current fee split is set in code via four constants and one configurable pool parameter:

| Recipient | Constant | Code path | BPS | % of fee |
|---|---|---|---:|---:|
| **SOL LPs** | (derived) | `src/api/server.js:796` | 8,000 | 80.0% |
| **$MAGPIE holders** | `HOLDER_REWARD_BPS` | `magpie-bot/src/services/magpie-holder-rewards.js:43` | 1,000 | 10.0% |
| **Referrers** | `REFERRAL_REWARD_BPS` | `magpie-bot/src/services/referral-rewards.js:30` | 500 | 5.0% |
| **LP loyalty pool** | `LP_LOYALTY_REWARD_BPS` | `magpie-bot/src/services/lp-loyalty.js:34` | 200 | 2.0% |
| **Protocol** | `protocolFeeBps` (on-chain pool config) | `magpie-bot/src/api/server.js:795` | 300 | 3.0% |
| **Total** | | | 10,000 | 100.0% |

The LP share is computed as the residual: `lp_fee_share_bps = 10_000 − (holder + referrer + loyalty + protocol)`. Changing any other constant automatically changes the LP share by the same amount; this is the mechanism this proposal uses to reduce the LP share by 5 pp.

The 10% holder share has been in effect since the $MAGPIE token launched in March 2026. As of mid-2026 the protocol has originated **more than 450 loans across over 2,700 unique wallets**, with **sub-1.5% lifetime liquidation rate** (live numbers verifiable at [magpie.capital/api/v1/stats](https://www.magpie.capital/api/v1/stats)).

## 3. Proposed change

Change `HOLDER_REWARD_BPS` from `1_000` (10%) to `1_500` (15%) in [`magpie-bot/src/services/magpie-holder-rewards.js`](https://github.com/magpiecapital/magpie-bot/blob/main/src/services/magpie-holder-rewards.js#L43).

No other constants change. The implicit LP share recomputes as `10_000 − (1_500 + 500 + 200 + 300) = 7_500` BPS = **75.0%**.

The resulting split:

| Recipient | Before | After | Change |
|---|---:|---:|---:|
| SOL LPs | 80.0% | 75.0% | **−5.0 pp** |
| $MAGPIE holders | 10.0% | 15.0% | **+5.0 pp** |
| Referrers | 5.0% | 5.0% | — |
| LP loyalty | 2.0% | 2.0% | — |
| Protocol | 3.0% | 3.0% | — |

Both new values sit within the Tier A4 bound (5%–15%). At 15%, the holder share is at the **upper bound** of A4; no further holder-favorable change is possible without a Tier C escalation to widen the bound.

## 4. Rationale

Three reasons.

**The protocol has earned the right to revisit the launch defaults.** The 10% / 80% / 5% / 2% / 3% split was set at launch as a best-estimate. Three months of sustained operation, 450+ loans, and 2,700+ unique users have given us real data about which stakeholder cohorts are sticky and which are not. $MAGPIE holders have demonstrated strong retention (holder count has only grown). SOL LPs have demonstrated price-elastic supply (the vault fills when yield is competitive). Shifting 5 pp from the elastic stakeholder to the sticky stakeholder reflects what we have learned.

**Holder yield should be visible enough to matter.** At 10% and the current protocol fee run-rate, holder distributions are real but small per holder. At 15%, the per-holder yield rises by 50% — meaningful enough that holders start comparing it against other Solana SOL yield (LSTs, marinade-style staking) when deciding to hold rather than sell. The token's purpose is to align long-term holders with protocol growth; the yield curve should support that purpose visibly.

**The LP economy can absorb 75% comfortably.** At 75%, SOL LPs still capture more than 7× what $MAGPIE holders do and 25× what referrers do. Historical vault TVL has been responsive to small yield changes within 2-3 percentage points; the 5 pp reduction here is large but not regime-changing. If LP TVL materially declines after execution, the operator retains discretion to file a follow-up A2 proposal (raise fees) to compensate.

### 4a. Long-term direction (context, not binding)

The long-term direction this proposal is the first step toward is **roughly 60% holders / 30% LPs**, with the remaining 10% covering referrers, LP loyalty, and protocol. That end state requires:

1. **A Tier C spec amendment** to widen A4's bound beyond the current 5–15% range (the upper bound is the limiting factor; the operator anticipates a target bound of 5–65%).
2. **A sequence of subsequent Tier A4 proposals** stepping the holder share up in measured increments after observing LP-side response at each step.

MGP-001 itself does not bind anyone to that direction. The 15% delivered here is fully reversible by a future proposal, and the bigger move would require its own contentious votes. The vision is documented so holders understand which long-term arc the operator believes is right; agreeing with MGP-001 is not agreement with the full arc.

## 5. Economic impact

The protocol distributes fees from gross loan fees. Worked numbers from the live protocol:

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

At the **proposed** 15% / 75% split, on the same lifetime fee base:

| Recipient | Lifetime SOL | Δ vs current |
|---|---:|---:|
| SOL LPs (75%) | ~7.88 SOL | **−0.53 SOL** |
| $MAGPIE holders (15%) | ~1.58 SOL | **+0.53 SOL** |
| Referrers (5%) | ~0.53 SOL | — |
| LP loyalty (2%) | ~0.21 SOL | — |
| Protocol (3%) | ~0.32 SOL | — |

These are retrospective figures for context only — the change is forward-only. For projecting future impact, use the same `holder_share_bps * future_fees / 10_000` formula against any future fee run-rate. The live fee run-rate is published at `/api/v1/stats.totalFeesEarnedLamports` and refreshes per request.

Per-LP impact depends on individual vault share. An LP holding 5% of the vault, at the current run-rate, gives up roughly the equivalent of 0.05 × 0.53 = 0.026 SOL across the protocol's lifetime under this change. Per-holder impact depends on individual $MAGPIE balance; holders with greater pro-rata supply share gain proportionally more.

## 6. Risks

1. **LP TVL contraction.** A 5 pp share reduction may cause some LPs to withdraw to chase higher yields elsewhere. If TVL falls materially, the operator may need to raise fees (via a subsequent A3 proposal) to restore LP APR — which transfers cost to borrowers and could slow borrowing volume.

2. **The bound is now exhausted.** Holder share at 15% is the upper bound of Tier A4. Any further holder-favorable change requires a Tier C escalation, which is a higher bar (80% / 15% / 30-day cooling-off). This proposal closes one of the model's optionality dimensions.

3. **Signal risk on lender-side stakeholders.** Reducing the LP share — even modestly — could be read by potential institutional or whale LPs as "the protocol does not value lender capital as a first-class stakeholder." This is a perception risk more than an economic one. Counter-evidence: 75% is still the largest share by 5×.

4. **Implementation drift.** The change touches a single BPS constant. Misconfiguration (changing the wrong constant, partial deployment, etc.) would produce an incorrect split. Mitigation: the executing commit must include a regression test verifying the new BPS values sum to 10_000.

5. **Treatment of in-flight loans.** The execution must explicitly affect only loans originated after the timestamp. If the code path is incorrectly modified to backfill distributions on existing loans, the proposal's commitment ("future loans only") is violated.

## 7. Dissent paths

Reasons a holder might legitimately vote NO:

- **Timing is wrong.** The protocol's recent oracle-manipulation event (June 7, 2026) and the in-flight site-pivot suggest the next 60 days are an unusually high-execution period. Holding the fee split stable during operational transitions is a defensible position.
- **Magnitude is wrong.** 10 → 15% is the maximum step within A4. A more conservative 10 → 12% or 10 → 13% gives the operator data on directional response before committing to the upper bound.
- **Recipient mix is wrong.** Holders are not currently underpaid relative to LPs in any apples-to-apples sense (LPs take real SOL-denominated risk; holders take token-price risk). Shifting more to holders without a corresponding risk takeup is, in this view, transferring economic surplus away from the cohort that bears the actual capital risk.
- **Bound exhaustion.** Using the full A4 bound on the first proposal forecloses gradualism. A subsequent shift to 16%, 18%, or 20% — if appropriate later — would require a more contentious Tier C escalation.

## 8. Verification

- **Vote weight basis:** voting weight per wallet equals the wallet's $MAGPIE balance at the time of proposal activation, with the exclusion list in [`GOVERNANCE.md`](../GOVERNANCE.md#voting-power) applied. The activation-time holder balance set and per-wallet voting weights are operator-internal in v0; they are not published.
- **Vote payloads:** each YES / NO / ABSTAIN is a wallet-signed structured message identifying the proposal ID and the vote. The operator records signed payloads to maintain the audit trail.
- **Aggregate publication:** at vote close, the operator publishes the aggregate YES weight, NO weight, ABSTAIN weight, eligible-supply total, quorum met / not met, and pass / fail result. Per-wallet vote choices are not published.
- **Quorum:** ≥ 5% of eligible supply must cast YES + NO (ABSTAIN does not count toward quorum).
- **Pass threshold:** ≥ 60% of (YES + NO) must be YES.
- **Operator-trust note:** v0 verification is operator-trust-based by design. v1 and v2 progressively move verification on-chain. The trust model evolves with the model version, not within v0.

## 9. Execution plan

If passed, the operator will, within 14 days of vote close:

1. Open a PR against `magpie-bot/main` titled `governance: MGP-001 holder share 10% → 15%`.
2. The PR modifies exactly one line: `magpie-bot/src/services/magpie-holder-rewards.js:43` from `export const HOLDER_REWARD_BPS = 1_000;` to `export const HOLDER_REWARD_BPS = 1_500;`.
3. Add a regression test asserting that `HOLDER_REWARD_BPS + REFERRAL_REWARD_BPS + LP_LOYALTY_REWARD_BPS + DEFAULT_PROTOCOL_FEE_BPS + LP_FEE_SHARE_BPS === 10_000`.
4. Update `community-pip.js` and `ai-support.js` system-prompt mentions of the fee split from `80% / 10% / 5% / 2% / 3%` to `75% / 15% / 5% / 2% / 3%`. Failure to update Pip's prompts will result in Pip giving outdated answers to community members.
5. Update `magpie-site/src/app/tokenomics/page.tsx`, `/magpie/page.tsx`, and `/api/v1/info` if they reference the 80/10 figures.
6. Commit message references "MGP-001" so future audits can trace the change.
7. Tag the deploy timestamp; the change applies to loans with `start_timestamp_unix >= deploy_timestamp_unix`.

Existing active loans accrue distributions at the previous 10% rate through their natural close. Distributions already paid to holder wallets are not clawed back. The retrospective in Section 11 will compare distribution rates against the executor's projections.

## 10. How to vote

Once active, vote at:

**https://www.magpie.capital/governance/proposal/MGP-001**

Connect your Solana wallet. Sign the YES / NO / ABSTAIN payload. No gas required; the signature is off-chain and auditable.

Discussion in [@magpietalk](https://t.me/magpietalk).

## 11. Lifecycle

- `2026-06-09` — drafted by @MagpieLoans
- `2026-06-09` — operator scope review passed; status → `active`; 3-day voting window opens (closes 2026-06-12)
- (target 2026-06-12) — status → `closed`, tally computed
- (target 2026-06-15 to 2026-06-26) — status → `executed` (passing) or `failed`
- (T+30 days post-execution) — retrospective: observed effects vs projected effects appended below
