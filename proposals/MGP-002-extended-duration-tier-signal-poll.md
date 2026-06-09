---
id: MGP-002
title: Signal poll — should Magpie add an Extended-duration loan tier (≥ 14 days)?
scope_tier: A6
status: draft
snapshot_slot: TBD
voting_window: TBD
author: "@MagpieLoans"
created_at: 2026-06-09
---

# MGP-002 — Signal poll: Extended-duration loan tier

## 1. Summary

A **non-binding** Tier A6 signal poll asking $MAGPIE holders: should Magpie add a fourth loan tier with a longer duration (≥14 days) than the current Standard tier (7 days)?

This poll does not change protocol parameters. It surfaces holder sentiment so the operator can decide whether to (a) proceed with a Tier C scope-amendment proposal to bring loan-duration adjustments into Tier A, and (b) draft a binding proposal to actually configure the new tier.

## 2. Background

The protocol currently offers three loan tiers:

| Tier | LTV | Duration | Fee |
|---|---:|---:|---:|
| Express | 30% | 2 days | 3.0% |
| Quick | 25% | 3 days | 2.0% |
| Standard | 20% | 7 days | 1.5% |

Tier definitions are public protocol constants visible at [`magpie-bot/src/services/tiers.js`](https://github.com/magpiecapital/magpie-bot) and mirrored in [`magpie-x402/src/lib/tiers.ts`](https://github.com/magpiecapital/magpie-x402/blob/main/src/lib/tiers.ts).

[`GOVERNANCE.md`](../GOVERNANCE.md) v0 does **not** include loan-duration adjustments in Tier A scope. Adding a new tier (or extending an existing tier's duration beyond its current value) is currently operator discretion. This poll exists to determine whether the protocol's holders want that authority moved into the governance scope, and what shape the change should take.

## 3. The question

For each statement below, vote YES if you agree, NO if you disagree, ABSTAIN otherwise. There is no "single winning option" — each statement is tallied independently.

> **Q1.** Magpie should add a fourth loan tier with a duration of at least 14 days.

> **Q2.** The new tier's LTV should be lower than the Standard tier's 20% (i.e. holding more collateral relative to the loan, reflecting the longer time-at-risk).

> **Q3.** The new tier's fee should be higher than the Standard tier's 1.5% (i.e. the borrower pays more for the longer commitment).

> **Q4.** Loan-duration adjustments should be moved from operator discretion into Tier A governance scope via a Tier C scope-amendment proposal.

A simple-majority YES on any individual question signals holder support for that direction. Because the poll is non-binding, the operator retains discretion on whether and how to act on each result.

## 4. Why this is non-binding

Two reasons.

**The question is exploratory, not specific.** A binding proposal needs to specify exact numbers: which duration, which LTV, which fee, which risk-engine implications. Holders haven't yet been asked whether they even want this direction — proposing specific numbers without that input would be premature.

**Duration is out of Tier A v0 scope.** A binding duration-change proposal would require a Tier C escalation first to amend the governance spec. That's a higher bar (80% pass / 15% quorum / 30-day cooling-off) than this signal poll (60% pass / 5% quorum / 7-day window). Running the signal poll first is the cheap way to figure out whether the Tier C escalation has support before incurring its overhead.

## 5. What happens after the poll closes

Per the model in [GOVERNANCE.md](../GOVERNANCE.md):

- If **Q1 + Q4 both pass:** the operator will draft a Tier C escalation proposal (MGP-003 or later) to add loan-duration adjustments to Tier A. If that escalation passes its higher threshold, a binding Tier A proposal to actually configure the new tier follows.
- If **Q1 passes but Q4 fails:** the operator may add the tier under operator discretion (still legal in v0), without governance ratification. The poll signals community demand without delegating authority.
- If **Q1 fails:** the operator commits not to add a new tier in the next 90 days. After 90 days, a fresh signal poll may be filed.
- For **Q2 and Q3** (parameter direction questions): these inform the design of any subsequent binding proposal but do not bind directly.

## 6. Risks

The risks of a *signal* poll are different from the risks of a binding proposal:

1. **Signal mismatch with binding follow-up.** A YES on Q1 here does not commit holders to vote YES on a future binding proposal with specific numbers. Operators should plan for the possibility that "yes in principle" doesn't translate to "yes in detail."
2. **Polling fatigue.** Cheap signal polls used too often dilute the meaning of any single vote. Use sparingly.
3. **Strategic abstain.** Holders may abstain to signal "I want more information before committing." If quorum is missed because of strategic abstain, the operator should treat the result as inconclusive rather than as a NO.

## 7. Dissent paths

Reasons to vote NO on Q1 specifically:

- **Magpie's product-market fit is in fast loans.** 60%+ of historical loans are Express (2-day). Adding a 14+ day tier may dilute the protocol's positioning as the fast SOL-borrowing surface on Solana.
- **Longer durations increase oracle-manipulation exposure.** The June 7 incident underscored how long collateral-at-risk windows give attackers more chances to find a manipulation path. A 14+ day window is meaningfully larger.
- **Risk-engine retuning cost.** Adding a tier isn't just adding a row to a config — the credit-oracle scoring, liquidation logic, and anti-exploit gauntlet were all calibrated against the existing three tiers. Adding a fourth tier is real work.

## 8. Verification

Same verification mechanics as MGP-001: snapshot slot, signed payloads, third-party re-tally. Eligibility and exclusion rules per [`GOVERNANCE.md`](../GOVERNANCE.md#voting-power).

Because this is a multi-question poll, the API endpoint will return per-question tallies rather than a single aggregate.

## 9. Execution plan

There is no binding execution. The operator publishes the per-question tally publicly at vote close, then:

- If Q1 + Q4 pass → drafts a Tier C escalation proposal within 30 days.
- If only Q1 passes → publishes a one-paragraph operational decision within 30 days on whether to add the tier under operator discretion.
- If Q1 fails → publishes a one-paragraph acknowledgement and the 90-day cooling-off begins.

In every case, the published result is referenced as the rationale for any subsequent design choice.

## 10. How to vote

Once active, vote at:

**https://www.magpie.capital/governance/proposal/MGP-002**

Discussion in [@magpietalk](https://t.me/magpietalk).

## 11. Lifecycle

- `2026-06-09` — drafted by @MagpieLoans
- (TBD) — operator scope review
- (TBD) — status → `active`
- (TBD) — status → `closed`, tally published per question
- (TBD) — operator response to each question's result published

---

## Roadmap — what's queued behind this poll

This is intentionally an exploratory step. The full path the operator anticipates, contingent on holder direction:

- **MGP-002 (this proposal)** — A6 signal poll on whether to pursue the extended-tier direction.
- **MGP-003 (conditional, if Q4 passes)** — Tier C escalation: move loan-duration adjustments into Tier A scope, with a defined bound (e.g. existing-tier durations adjustable ±2 days; new-tier additions allowed at 14d / 30d boundaries).
- **MGP-004 (conditional, if MGP-003 passes)** — Tier A binding proposal: configure the actual Extended tier (specific LTV %, specific fee %, specific max duration).

Separately and outside this poll, two other proposals are queued and will follow MGP-001:

- **MGP-005 (planned)** — A2 Express-tier LTV adjustment (direction and magnitude TBD — operator will gather community input before drafting).
- **MGP-006 (planned)** — A2 Quick-tier LTV adjustment (same).
- **MGP-007 (planned)** — A3 fee-rate adjustments (per tier; one proposal each).
