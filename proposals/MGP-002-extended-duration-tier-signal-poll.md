---
id: MGP-002
title: Signal poll — should Magpie add a Premium tier (30-day, 40% LTV, 5% fee, tokenized stocks only)?
scope_tier: A6
status: withdrawn
voting_window: 2026-06-09 to 2026-06-12 (withdrawn before close)
author: "@MagpieLoans"
created_at: 2026-06-09
activated_at: 2026-06-09
withdrawn_at: 2026-06-09
---

> **WITHDRAWN 2026-06-09.** This proposal was activated on 2026-06-09 as a non-binding signal poll on whether Magpie should add a Premium tier. The operator decided to ship the Premium tier (with **both 15-day and 30-day duration options**) under Tier B operator discretion rather than running the poll to conclusion. Tier B is the legitimate path per [GOVERNANCE.md v0](../GOVERNANCE.md) — loan-duration adjustments and new-tier additions are operator-discretion in v0; this proposal explored whether to move them into Tier A via a Tier C escalation. The operator's choice not to escalate is itself within scope.
>
> Execution plan for the Premium tier (15-day + 30-day, tokenized stocks only) is documented in `magpie-bot/docs/PREMIUM-TIER-DEPLOY-PLAN-2026-06-09.md`. The exit plan in §7 of this proposal (Q1 passes, Q2 fails → operator ships under discretion) is the path being taken.
>
> Any votes submitted against MGP-002 are recorded in `governance_votes` and visible in the aggregate endpoint but will not be tallied or acted on. The intent of any holder who voted YES on Q1 is being honored by shipping the tier; the intent of any holder who voted YES on Q4 (eligibility screener gates) is being honored by adopting the screener spec referenced in the deploy plan.
>
> The original proposal text follows for the record.

---


# MGP-002 — Signal poll: Premium tier (tokenized stocks)

## 1. Summary

A **non-binding** Tier A6 signal poll asking $MAGPIE holders: should Magpie add a fourth loan tier — **30-day term, 40% LTV, 5% upfront fee, tokenized-stock collateral only** — as a Premium product distinct from the existing Express / Quick / Standard tiers?

This poll does not change protocol parameters. It surfaces holder sentiment so the operator can decide whether to (a) draft the Tier C scope amendment that brings loan-duration adjustments into governance scope, (b) deploy `magpie-lending-v3` with the new tier, and (c) ship the off-chain eligibility screener that gates which tokens qualify.

## 2. Background

The protocol currently offers three tiers:

| Tier | LTV | Duration | Fee | Collateral types |
|---|---:|---:|---:|---|
| Express | 30% | 2 days | 3.0% | All approved tokens |
| Quick | 25% | 3 days | 2.0% | All approved tokens |
| Standard | 20% | 7 days | 1.5% | All approved tokens |

Tier values are protocol constants in [`magpie-lending/src/lib.rs`](https://github.com/magpiecapital/magpie-bot/blob/main/programs/magpie-lending/src/lib.rs) at `TIER_LTV_BPS / TIER_DURATION_DAYS / TIER_FEE_BPS`. They are NOT changeable on the live program — adding a fourth tier requires deploying a parallel program (v3 scaffold already exists at `programs/magpie-lending-v3/`).

[`GOVERNANCE.md`](../GOVERNANCE.md) v0 keeps loan-duration changes in Tier B (operator discretion). Adding a Premium tier with a 30-day duration is technically out of Tier A scope. This signal poll exists to determine whether holders want that authority moved into governance scope via a Tier C escalation **and** whether the proposed Premium-tier parameters are the right shape if and when it ships.

## 3. The proposal in detail

| Parameter | Value | Why this number |
|---|---|---|
| **Term** | 30 days | Matches monthly-options cadence; gives equity holders enough time to actually use the leverage productively |
| **LTV** | 40% | The high end of comfortable for equities; traditional brokerages allow 50–70% on stocks |
| **Upfront fee** | 5% | ≈60% annualized — high enough to absorb expected losses + give holders a meaningful bump; low enough not to scare off the sophisticated equity-holder audience |
| **Eligible collateral** | **Tokenized stocks only** (category = `stock`), further restricted by per-borrow screener gate (see §4) | Stocks have institutional-grade price feeds and fundamentally lower volatility than memecoins. Memecoins at 40% LTV / 30-day are a coinflip — not a coherent product. |
| **Per-loan cap** | 10 SOL (initial) | Start tight; ratchet up once we have liquidation data |
| **Per-token aggregate cap** | 10 SOL per stock (initial) | Don't concentrate exposure on one ticker |
| **Pool** | **Separate vault from existing tiers** | Premium-tier liquidity is segregated so a Premium liquidation event cannot eat existing LP yield. New LPs can opt in to either pool. |
| **Liquidation logic** | Same permissionless on-chain ix as existing tiers | Reuse the proven liquidation surface |
| **Anti-exploit gauntlet** | Full existing gauntlet + an additional on-chain TWAP check (already implemented in v3) | Longer duration = more attack surface; add the on-chain TWAP that v3 already ships |

## 4. The eligibility screener (cream-of-the-crop gate)

A token does NOT qualify for Premium-tier borrowing just by being tagged `stock`. Every Premium-tier borrow goes through a runtime eligibility check in `magpie-bot/src/services/premium-tier-screener.js` (spec drafted in parallel with this proposal). The screener requires ALL of:

1. **Category = stock** in `supported_mints`.
2. **On the per-pool Premium whitelist** (initial: 5–10 tickers chosen for liquidity + feed quality; can be expanded by operator with subsequent A1 collateral-add proposals).
3. **Institutional-grade price feed available** (Pyth/Switchboard) — refuses borrow if the feed is stale, in degraded mode, or missing.
4. **24-hour DEX volume floor** of $X (initial: $250K — small enough to seed; tightens as the tier matures).
5. **Liquidation simulator passes** — at the loan's worst-case (collateral drops to 1/0.4 = 250% of borrow value), the simulator confirms the collateral can be unwound on-chain within 1 hour at current depth.
6. **Per-borrower history check** — first Premium-tier borrowers need a clean credit-oracle history (no liquidations in the last 90 days).

If any check fails, the borrow is refused with a specific reason. Same UX as the existing gauntlet rejection.

## 5. The question

Vote YES if you agree, NO if you disagree, ABSTAIN otherwise. Each sub-question is tallied independently.

> **Q1.** Magpie should add a Premium tier with the parameters above (30-day, 40% LTV, 5% fee, tokenized stocks only).
>
> **Q2.** Loan-duration adjustments should move from operator discretion into Tier A governance scope via a Tier C scope-amendment proposal (so future tier-duration changes are votable).
>
> **Q3.** The Premium tier should launch with a **separate liquidity pool** rather than sharing the existing pool's LP capital.
>
> **Q4.** The eligibility screener parameters (whitelist + feed-quality check + volume floor + liquidation-solvability check + clean-credit requirement) are the right shape.

A simple-majority YES on any individual question signals holder support for that direction.

## 6. Why this is non-binding

Two reasons.

**The on-chain implementation requires a new program deploy.** That's not a parameter change — it's a `magpie-lending-v3` deployment with a fresh program ID, parallel pool initialization, and bot integration work. Holders should signal whether they want this *direction* before the operator invests the engineering time.

**The exact parameters benefit from real holder input.** The numbers above are the operator's best-faith proposal, but ±5pp on LTV or ±0.5% on fee might be the right call. A signal poll surfaces feedback cheaply before the binding (post-Tier-C) proposal.

## 7. What happens after the poll closes

- **If Q1 + Q2 both pass:** the operator drafts a Tier C escalation proposal (MGP-003) to move loan-duration adjustments into Tier A, then a binding Tier A proposal (MGP-004) to configure the Premium tier with whatever parameters Q1 + Q3 + Q4 indicate the community wants. v3 deploy work proceeds in parallel.
- **If Q1 passes but Q2 fails:** the operator MAY add the tier under Tier B operator discretion (still allowed in v0). Adoption proceeds without governance ratification. Q3 and Q4 inform the design.
- **If Q1 fails:** the operator commits not to ship the Premium tier in the next 90 days. After 90 days, a fresh signal poll may be filed.

## 8. Risks

1. **Liquidity fragmentation.** A separate Premium pool splits LP attention; one or both pools may struggle to maintain depth. Mitigation: launch with a seed deposit and time-boxed LP incentive for Premium-pool depositors.
2. **Liquidation cascade.** A correlated drawdown across the Premium-tier whitelist (e.g. broad equity selloff) liquidates multiple loans simultaneously. Per-token aggregate cap (10 SOL) limits blast radius; per-stock liquidation events are uncorrelated with memecoin liquidations so v1 pool is insulated.
3. **Feed degradation.** The on-chain TWAP + Pyth feed dependence means a feed outage refuses borrows but also blocks liquidations of in-flight loans. Mitigation: liquidation falls back to the off-chain bot's cross-source price agreement during feed outage.
4. **Engineering surface area.** v3 deploy, parallel pool, bot integration, site UI — meaningful work. Realistic timeline: 4–6 weeks from go-ahead to first Premium-tier loan.

## 9. Dissent paths

- **40% LTV is too aggressive even for stocks.** A conservative dissent might prefer 35% LTV at 30 days — gives more margin for adverse moves.
- **30 days is too long.** A 15-day variant might fit the same risk envelope at 40% LTV with less duration risk.
- **Stocks-only is too narrow.** A "diamond memecoin" track might be added later, but doing it at launch concentrates risk in one product class.
- **Wait for v1 to season.** Three months of operation is short; the protocol may benefit from another quarter of v1-only data before fragmenting attention into a new tier.

## 10. Verification

Same verification mechanics as MGP-001: vote weight by activation-time $MAGPIE balance with the exclusion list applied; signed payloads recorded by the operator; aggregate result published at vote close. Per-wallet vote choices and the activation-time holder balance set are operator-internal.

Because this is a multi-question poll, aggregate publication returns per-question tallies (Q1 / Q2 / Q3 / Q4) rather than a single aggregate.

## 11. Execution plan

Non-binding. The operator publishes per-question tallies at vote close and a written response within 30 days explaining the chosen path forward.

If the chosen path includes the Tier C escalation (MGP-003) and the Tier A binding proposal (MGP-004), drafts of both will be filed within 30 days of the published response.

If the chosen path is operator-discretion ship (Q1 passes, Q2 fails), the operator publishes the implementation plan + timeline within 30 days.

## 12. How to vote

Once active, vote at:

**https://www.magpie.capital/governance/proposal/MGP-002**

Discussion in [@magpietalk](https://t.me/magpietalk).

## 13. Lifecycle

- `2026-06-09` — drafted by @MagpieLoans (re-scoped from prior generic-extended-tier draft to specific Premium-tier parameters)
- `2026-06-09` — operator scope review passed; status → `active`; 3-day voting window opens
- (2026-06-12) — status → `closed`, tally published per question
- (TBD) — operator response to each question's result published within 30 days

---

## Roadmap (contingent on poll outcome)

- **MGP-002 (this proposal)** — A6 signal poll: should the Premium tier ship at these parameters?
- **MGP-003 (conditional, if Q2 passes)** — Tier C escalation: move loan-duration adjustments into Tier A scope.
- **MGP-004 (conditional, if MGP-003 passes)** — Tier A binding proposal: deploy `magpie-lending-v3` with Premium tier at the agreed parameters; initialize the separate Premium pool.
- **MGP-005+ (planned)** — A1 collateral additions to the Premium whitelist as new tokenized stocks become eligible per the screener.

Independent of this poll, the existing queue of A2 (Express/Quick LTV adjustments) and A3 (per-tier fee adjustments) proposals remains; those are tier-1 work for the current Express/Quick/Standard tiers and don't depend on MGP-002.
