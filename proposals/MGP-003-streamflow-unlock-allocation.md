---
id: MGP-003
title: Allocation decision for the July 1, 2026 $MAGPIE Streamflow unlock (~5% of supply)
scope_tier: A6 (binding by operator commitment — see §3)
status: active
voting_window: 2026-06-25T00:00:00Z to 2026-06-30T00:00:00Z (5 days; opens Jun 24 8:00 PM ET, closes Jun 29 8:00 PM ET)
activated_at: 2026-06-25T00:00:00Z
author: "@MagpieLoans"
created_at: 2026-06-09
rescoped_at: 2026-06-18
---

# MGP-003 — Streamflow unlock allocation (5% of $MAGPIE supply)

## 1. Summary

On **July 1, 2026**, a Streamflow vesting contract holding **~5% of total $MAGPIE supply (~50M tokens)** unlocks. The operator brings this allocation decision to the community as a binding vote rather than executing under operator discretion (Tier B).

**Contract:** [`GQztjhq4xA1NGwaKZTsTENUjxMaK5eoMD378sqczbhvc`](https://app.streamflow.finance/contract/solana/mainnet/GQztjhq4xA1NGwaKZTsTENUjxMaK5eoMD378sqczbhvc)

Holders vote between **four enumerated allocation options**. The winning option binds the operator's execution within 14 days of the unlock date.

**Constraint:** every option avoids any single-event liquidity release. No "release everything to the market at once" path is on the ballot.

## 2. The four options

### Option A — Patience (36-month re-lock)
- **Action:** 100% of the ~50M re-locked into a new Streamflow contract, 36-month linear vest ending July 2029
- **Beneficiary:** same address holds the new contract (decision is deferred)
- **No spending. No distribution. No supply change today.**
- **Best for:** voters who think July 2026 is not the right unlock moment and want optionality preserved

### Option B — Loyalty (24-month holder vest)
- **Snapshot taken at proposal close** (2026-06-30 00:00 UTC = 8:00 PM ET 2026-06-29)
- **Eligibility:** current $MAGPIE holders using existing snapshot rules (in-wallet + collateralized; burn / bonding curve / treasury / operator-curated exempt list all excluded)
- **Delivery:** 100% pro-rata via Streamflow linear vest — each holder unlocks ~0.137%/day of their slice over 24 months
- **No instant dump** — supply enters circulation gradually over 2 years
- **Best for:** voters who want today's holders to receive the upside

### Option C — Build (24-month locked Growth Treasury)
- **Action:** 100% to a multi-sig Magpie Treasury, locked **24 months minimum**
- **Pre-declared spend categories** (treasury can ONLY spend on these):
  - Deep $MAGPIE liquidity provisioning (Raydium / Meteora pair depth)
  - Partner protocol integrations + x402 ecosystem grants
  - Third-party security audits (public reports)
  - Matched LP top-ups (1:1 with new community LP positions above threshold)
  - Time-bound user incentive campaigns (announced 30 days in advance)
- **Transparency:** every cent spent surfaces on [magpie.capital/distributions](https://magpie.capital/distributions) with on-chain receipt
- **Multisig:** Squads vault with hardware-key signer (same model as upgrade-authority migration)
- **Best for:** voters who want the protocol to scale on real capital

### Option D — Discipline + Build (50% burn + 50% Treasury)
- **25M burned permanently** (2.5% supply reduction: ~996.7M → ~971.7M)
- **25M to Growth Treasury** with identical rules as Option C (24-month lock, categorical spend, on-chain logging)
- **Mechanic:** 1 burn tx + 1 Squads vault creation
- **Best for:** voters who want both permanent deflation AND a growth runway

### ABSTAIN
- Defers the decision to operator discretion
- ABSTAIN ≥ 30% of cast vote triggers operator-discretion fallback per §3

## 3. Scope tier + binding

- **Tier:** A6 — outside Tier A4's standard parameter bounds, but the operator commits to honor the result as if it were Tier A binding (same path as MGP-001's 70/10/10/10 split).
- **Binding within 14 days of unlock** (July 1 → July 15, 2026).
- **Operator discretion fallback:** if ABSTAIN wins outright OR participation < 7.5% quorum, operator chooses among the four options at their discretion (must publicly disclose reasoning).

## 4. Voting mechanics

- **Window:** 2026-06-24 8:00 PM EDT → 2026-06-29 8:00 PM EDT (5 days)
- **Quorum:** ≥ 7.5% of eligible supply (non-ABSTAIN cast weight, whale-capped)
- **Pass threshold:** plurality, winner must collect > 40% of non-ABSTAIN cast weight
- **Whale cap:** 2% per voter on the participation denominator (matches MGP-001)
- **Eligibility:** $MAGPIE holders at activation snapshot. Collateralized $MAGPIE counts 1:1 alongside in-wallet balances. LP positions in the SOL pool earn weight proportional to their share-seconds.
- **Vote rules:** wallet message-sign (no SOL gas). Re-sign with a different choice any time before close — latest signature wins.

## 5. Execution path

| Option | Execution |
|---|---|
| **A — Patience** | 1 new Streamflow contract create (operator signs). Total cost ~0.05 SOL. |
| **B — Loyalty** | Snapshot script runs at close, generates one Streamflow contract per eligible holder via batch. Total cost depends on holder count (~0.005 SOL × ~1,800 holders ≈ ~9 SOL). |
| **C — Build** | Squads vault created with hardware-key signer. Tokens transferred. First-spend gated by 24-month soft-lock + spend category match. |
| **D — Discipline + Build** | 1 burn tx for 25M + Squads vault for 25M (same as C). |

All execution receipts publicly logged on [magpie.capital/distributions](https://magpie.capital/distributions) per the unified distribution accounting rule.

## 6. Constraints

- Operator may not split the allocation outside the four options (no improvised hybrid)
- Execution must complete within 14 days of unlock OR operator must publicly explain the delay
- If C or D wins, the multisig signer set must be disclosed before any treasury spend
- All burns are SPL Burn instructions (on-chain provable supply reduction), not transfers to the burn address

## 7. Voting record + transparency

- Per-wallet votes stay private; aggregate weights are public
- Tally refreshes live on [magpie.capital/governance/proposal/MGP-003](https://magpie.capital/governance/proposal/MGP-003)
- Bars update within ~200ms of vote signature (no waiting)
- Final tally + signed snapshot published at close; operator commits to a public outcome announcement within 24 hours of close

## 8. Changelog

- 2026-06-09 — draft published with 5-option ballot, 3-day window
- 2026-06-18 — **rescoped + rescheduled:** consolidated to 4 options (no instant releases; burn appears only as part of Option D hybrid); voting window extended to 5 days; opens June 24
