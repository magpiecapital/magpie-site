---
id: MGP-003
title: Allocation decision for the July 1, 2026 $MAGPIE Streamflow unlock (~5% of supply)
scope_tier: A6 (binding by operator commitment — see §3)
status: active
voting_window: 2026-06-12T00:00:00Z to 2026-06-15T00:00:00Z (3 days)
activated_at: 2026-06-12T00:00:00Z
author: "@MagpieLoans"
created_at: 2026-06-09
---

# MGP-003 — Streamflow unlock allocation (5% of $MAGPIE supply)

## 1. Summary

On **July 1, 2026**, a Streamflow vesting contract holding **~5% of total $MAGPIE supply (~50M tokens)** unlocks. The operator brings this allocation decision to the community as a binding vote rather than executing under operator discretion (which would be Tier B in the current governance model).

**Contract:** [`GQztjhq4xA1NGwaKZTsTENUjxMaK5eoMD378sqczbhvc`](https://app.streamflow.finance/contract/solana/mainnet/GQztjhq4xA1NGwaKZTsTENUjxMaK5eoMD378sqczbhvc)

Holders vote between five enumerated allocation options. The winning option binds the operator's execution within 14 days of the unlock date, subject to the constraints in §6.

## 2. Background

**The contract.** ~5% of $MAGPIE total supply (~50M tokens at the current ~999M circulating, exact figure resolves on unlock day) is held by a Streamflow vesting contract that unlocks on July 1, 2026. The contract is public and auditable on Solana — anyone can inspect the schedule, recipient, and unlock terms via Solscan or the Streamflow UI.

**Why it exists.** This allocation predates the v0 governance model. The operator has chosen to bring its disposition to holders rather than execute discretionally because (a) the size is material and (b) the holder community is the legitimate constituency to decide how a 5% supply event should be handled. Treating this as a precedent: any future material discretionary allocation will be brought through governance before execution wherever the operational timeline allows.

**Why now.** The unlock date is fixed by the on-chain contract. Once unlocked, the tokens become movable. The community decision must close and execute before that date or the operator falls back to discretion-by-default.

**What this is not.** This is not a token sale, presale, treasury raise, or new emission. The supply already exists; this vote determines where the unlocked balance goes.

## 3. Why this is binding despite being out of formal Tier A scope

Token allocation is explicitly Tier B (operator discretion) in [GOVERNANCE.md v0](../GOVERNANCE.md). The proper procedural path (Tier C escalation → 30-day cooling-off → Tier A binding vote) does not fit the operational timeline before July 1.

Rather than execute under Tier B discretion, the operator commits in this proposal text to **honor the winning option as if it had passed via Tier A**. This is a one-time exception, documented explicitly so it does not silently expand Tier A. A subsequent Tier C escalation may bring "material discretionary allocations" into Tier A as a standing scope expansion.

If this approach is unsatisfactory to enough holders, the dissent path is to vote ABSTAIN on every option below; aggregate abstain ≥ 30% of cast votes signals the community wants the operator to use discretion instead, and the operator will revert to a Tier B decision with a published rationale.

## 4. The five options

Each option is described with its execution mechanics, expected impact, who benefits, and what risks it introduces. Holders vote for ONE option (single-choice). Operator may consider secondary preferences if no option exceeds 40% in the first count.

### Option A — Burn

**Mechanics.** Upon unlock, the full ~50M $MAGPIE balance is transferred to a verified burn address (sent to the System Program `1111…1111` with a memo `magpie-mgp003-burn`, or to a recognized verified burn destination). Permanent supply reduction; tokens cannot be recovered.

**Effect on supply.** Total / circulating / max supply drops by ~5% (50M). Per-holder pro-rata stake of every other holder increases proportionally.

**Pros.**
- Maximal deflationary signal to existing holders. Their position is worth ~5% more relative to the total supply.
- Simplest execution — one on-chain transaction, no recipient list to build, no off-chain coordination.
- No new selling pressure introduced.
- Reduces FUD around "the locked allocation will dump."

**Cons.**
- No operational flexibility. Once burned, those tokens are gone.
- No direct reward to specific holders or users.
- Loses ~50M tokens worth of capital that could fund protocol growth.

**Execution complexity:** Lowest. ~1 day post-unlock.

### Option B — Re-lock (extend lock 12 months)

**Mechanics.** Upon unlock, the balance is immediately re-deposited into a new Streamflow contract that re-locks for an additional 12 months (new unlock: July 1, 2027). New contract address published with the execution receipt.

**Effect on supply.** No immediate change. The decision is deferred 12 months.

**Pros.**
- Buys time. The protocol matures over 12 more months, and the next decision is made with more data and more holder participation.
- No new selling pressure introduced.
- Optionality preserved — future MGPs can pick from a wider option set.

**Cons.**
- Punts the decision; doesn't resolve the underlying question.
- Adds another deadline at the same urgency in 12 months.
- Holders who wanted action now feel ignored.

**Execution complexity:** Low. Streamflow contract creation is a standard operation; ~1 day post-unlock.

### Option C — Pro-rata distribution to $MAGPIE holders

**Mechanics.** Upon unlock, the ~50M tokens are distributed pro-rata to every wallet holding $MAGPIE at a snapshot taken before announcement (operator-internal snapshot; vote-weight basis is unrelated and earlier).

To prevent dump pressure, the distribution itself is **streamed over 30 days** via a new Streamflow contract — each recipient gets 1/30th of their allocation per day, sent directly to the holder wallet. No claim transaction required. Wallets on the excluded list ([GOVERNANCE.md → Voting Power](../GOVERNANCE.md#voting-power)) — DEX pools, operator wallet, burn addresses — do not receive distributions.

**Effect on supply.** No supply change. Tokens move from the Streamflow contract to the holder set; circulating remains the same. Some holders likely sell their stream; others compound back into the protocol.

**Pros.**
- Direct reward to existing holders — strongest holder-aligned outcome of any option.
- 30-day stream smooths sell pressure vs. lump-sum distribution.
- Sends the signal that loyalty to the protocol is rewarded.

**Cons.**
- Distribution math: top 100 holders capture most of the distribution. Whale-concentrated by design.
- Sell pressure over 30 days, even smoothed, is real.
- Requires holder-snapshot infrastructure plus a 30-day distribution stream.

**Per-holder cap.** No wallet may receive more than 1% of the total distribution (~500k tokens). The remainder above the cap is sent to the **next-largest wallets below the cap**, then to the burn address if all wallets at cap.

**Execution complexity:** Medium. Snapshot + Streamflow contract + cap math; ~1 week post-unlock.

### Option D — Distribution to protocol users (utility-weighted)

**Mechanics.** Upon unlock, the ~50M tokens are distributed to wallets that have *used* the protocol (borrowed, repaid, LP-deposited, or referred a successful loan), weighted by lifetime fees paid (or equivalent contribution metric — for LPs, time-weighted share-seconds). Distribution streams over 30 days via Streamflow.

**Effect on supply.** Same as C — no supply change. Tokens move to active users.

**Pros.**
- Rewards utility, not just holding. Encourages engagement.
- Concentrated among users who are aligned with the protocol's economic success (paid fees, provided liquidity).
- More resistant to sell pressure than C — utility-aligned recipients are more likely to be believers.

**Cons.**
- Existing $MAGPIE holders who didn't use the protocol receive nothing. May feel punitive.
- Weighting methodology is complex — fee-paid vs. fees-routed vs. time-weighted share-seconds vs. referrals — and any choice creates winners and losers.
- Easier to game over time (large LPs scrape the airdrop window).

**Recipient definition.** All wallets that EITHER:
- Originated at least 1 successfully-repaid loan, OR
- Held an LP position for ≥ 7 days at any point, OR
- Referred at least 1 successful loan
between protocol launch (March 2026) and the unlock date.

**Weighting.** Lifetime fees paid (borrower side) + time-weighted share-seconds × 0.001 (LP side) + 0.5 SOL flat per referrer per successful referee, summed; pro-rata to total.

**Execution complexity:** Higher. Requires user-set determination + weight calculation + Streamflow distribution; ~10 days post-unlock.

### Option E — Hybrid (50% burn, 25% holders, 25% users)

**Mechanics.** Three concurrent execution paths:

- **25M tokens (50%)** → burn (same mechanics as Option A)
- **12.5M tokens (25%)** → pro-rata distribution to $MAGPIE holders (same mechanics as Option C, scaled to 25M base)
- **12.5M tokens (25%)** → utility-weighted distribution to protocol users (same mechanics as Option D, scaled to 25M base)

**Effect on supply.** Net supply reduction of 2.5% (25M burned). Holders + users each receive half of what they'd receive under their single-option equivalents.

**Pros.**
- Spreads benefit across constituencies — no single group dominates.
- Burns half the allocation, capturing the deflationary signal at a smaller scale.
- Rewards both holding and using — best alignment incentive.
- Diversifies execution risk — if one distribution method breaks, the others proceed.

**Cons.**
- Each individual recipient receives less than under their single-option equivalent.
- Highest execution complexity — three concurrent paths to coordinate.
- "Compromise" option may feel watered down to advocates of any single direction.

**Execution complexity:** Highest. Three concurrent paths over ~14 days post-unlock.

## 5. Voting structure

Each holder selects ONE of {A, B, C, D, E, ABSTAIN}. Tally is published per option at vote close.

**Pass threshold:** Plurality (most votes wins) IF the winning option exceeds 40% of cast votes (excluding ABSTAIN). If no option exceeds 40%, the operator considers secondary signals (write-in preferences from @magpietalk discussion + concentration of votes among adjacent options) and publishes a binding decision with rationale within 7 days of vote close.

**Quorum:** ≥ 7.5% of eligible $MAGPIE supply must cast a non-ABSTAIN vote for the result to bind. Below 7.5% participation, the operator reverts to Tier B discretion with a published rationale.

**Abstain ≥ 30%:** if aggregate ABSTAIN exceeds 30% of cast votes, the community is signaling preference for operator discretion. The operator chooses an allocation from {A, B, C, D, E} with a published rationale.

## 6. Execution plan + constraints

**Timeline.**
- 2026-06-12 (target) — MGP-003 status → `active`, voting window opens (3 days)
- 2026-06-15 — voting closes; aggregate result published per option
- 2026-06-15 to 2026-06-22 — operator finalizes execution plan for the winning option; publishes the technical execution plan and any contract addresses
- 2026-07-01 — Streamflow contract unlocks; execution begins immediately
- 2026-07-01 to 2026-07-15 — execution window (≤14 days post-unlock); status flips to `executed`
- 2026-07-31 — operator publishes a retrospective with on-chain proof of execution

**Constraints.**
1. No allocation may benefit the operator wallet or any operator-controlled address. The operator-controlled set is excluded from any C/D/E distribution.
2. Any distribution stream must be **on-chain Streamflow** (or equivalent verifiable mechanism) so the schedule is publicly auditable.
3. Any burn must use a verified burn destination and be accompanied by an on-chain memo `magpie-mgp003-burn` for traceability.
4. If the winning option is C, D, or E, the snapshot/eligibility set used for distribution is published at execution time (timing of the snapshot is operator-internal; the contents at execution time are public).
5. If execution is delayed past the 14-day post-unlock window, the operator publishes a written explanation within 24 hours of the deadline.
6. The operator may NOT unilaterally substitute a different option after the vote closes (e.g., "B won but I decided to burn instead"). The only escape is the published-rationale discretion path triggered by < 7.5% quorum or ≥ 30% ABSTAIN.

## 7. Risks

1. **Market reaction.** Any large supply event creates volatility. Burn = bullish narrative but no liquidity event; distribution = sell pressure even when streamed. Cannot be eliminated; mitigated by 30-day streaming for C/D.
2. **Concentration risk in Option C.** Top-10 holders capture meaningful share even after the 1% cap. Mitigation: per-wallet cap with overflow redistribution to mid-tier holders.
3. **Eligibility disputes in Option D.** Borrowers, LPs, and referrers may dispute weighting. Mitigation: weighting formula published before vote close; results published with raw inputs so anyone can re-derive.
4. **Streamflow contract risk.** New Streamflow contracts for re-lock (B) or distribution (C/D/E) inherit Streamflow's protocol risk. Mitigation: prefer audited and widely-used Streamflow contract types only.
5. **Execution slippage.** Concurrent distributions across thousands of wallets create transaction-cost overhead and potential failures. Mitigation: budget extra SOL for transaction fees; retry logic for failed distributions.
6. **Governance precedent.** A successful binding Tier B → de-facto-Tier-A vote may pressure future material discretionary decisions through the same path. Mitigation: §3 explicitly limits this to a one-time exception; subsequent Tier C escalation is the legitimate way to expand Tier A.

## 8. Dissent paths

Reasons a holder might legitimately vote a particular way:

- **Vote A (burn)** if you believe the protocol's main lever is signal-of-scarcity to attract holders.
- **Vote B (relock)** if you believe the protocol isn't mature enough to commit; defer to a more informed future decision.
- **Vote C (holder rewards)** if you believe the existing holder base earned this through their loyalty and is the proper constituency.
- **Vote D (user rewards)** if you believe utility-aligned distribution is more strategically valuable than holder-aligned distribution.
- **Vote E (hybrid)** if you believe no single direction captures the best of multiple outcomes.
- **Vote ABSTAIN** if you believe the operator is better positioned to choose, or if you believe this question shouldn't be put to a vote at this stage.

## 9. Verification

Vote-weight basis: $MAGPIE balance at proposal activation; mechanism specifics operator-internal in v0. Aggregate per-option tally publishes at vote close; per-wallet votes do not.

Execution verification:
- All on-chain transactions (burn, Streamflow contract creation, distributions) publish their signatures at execution time.
- Distribution recipient lists (for C/D/E) publish with raw inputs so anyone can re-derive the weights from public on-chain data.
- 30-day post-execution retrospective compares actual execution against proposal commitments.

## 10. How to vote

Once active, vote at:

**https://www.magpie.capital/governance/proposal/MGP-003**

During the v0 wallet-signed vote-flow build, intent collection happens in [@magpietalk](https://t.me/magpietalk). Post your intent as:

```
MGP-003 vote · [A | B | C | D | E | ABSTAIN]
```

## 11. Lifecycle

- `2026-06-09` — drafted by @MagpieLoans
- (TBD) — operator scope review
- (target 2026-06-12) — status → `active`; voting window opens
- (target 2026-06-15) — status → `closed`, per-option tally published
- (target 2026-06-22) — operator publishes execution plan for winning option
- `2026-07-01` — Streamflow contract unlocks; execution begins
- (target 2026-07-15) — status → `executed`
- (target 2026-07-31) — 30-day retrospective published
