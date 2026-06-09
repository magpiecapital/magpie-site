# Magpie Governance Proposals

Each file in this directory is one governance proposal. The convention exists so that anyone — holder, agent, future operator — can audit the full history of what was proposed, when, by whom, with what rationale, and how the vote resolved.

## File naming

```
MGP-NNN-short-kebab-slug.md
```

- `MGP` = Magpie Governance Proposal
- `NNN` = monotonically increasing zero-padded integer, never reused
- slug = 3–6 word summary in kebab-case

Examples:
- `MGP-001-holder-distribution-share-15pct.md`
- `MGP-002-extended-duration-tier-signal-poll.md`

## Required frontmatter

Every proposal must lead with this exact YAML block:

```yaml
---
id: MGP-NNN
title: <one-line title>
scope_tier: A1 | A2 | A3 | A4 | A5 | A6 | C
status: draft | active | closed | executed | failed | withdrawn | rejected
voting_window: <ISO date range, or "TBD">
author: <pubkey or @MagpieLoans>
created_at: <YYYY-MM-DD>
---
```

The `scope_tier` MUST match a clause in [GOVERNANCE.md](../GOVERNANCE.md). Tier B items are not eligible for proposals. Tier C is only used for spec-amendment proposals.

## Required sections

Every proposal must contain, in this order:

1. **Summary** — one paragraph, third-person, factual. What is being changed, from what, to what.
2. **Background** — current protocol state. Cite code paths, on-chain accounts, or live API endpoints. Anything claimed as fact must be verifiable on-chain or in this repo.
3. **Proposed change** — the exact change requested, with specific numbers, dates, or code modifications.
4. **Rationale** — why this change, why now. Honest. No hyperbole.
5. **Economic / protocol impact** — worked numbers showing the effect. Use real protocol data from `magpie.capital/api/v1/stats` where possible. Don't extrapolate beyond what the data supports.
6. **Risks** — what can go wrong if this passes. List them. A proposal with no listed risks fails review.
7. **Dissent paths** — at least two legitimate counterarguments a NO vote could be based on. The proposer's job is to surface these, not hide them.
8. **Verification** — how vote weights are determined (activation-time $MAGPIE balance, exclusion list per GOVERNANCE.md), quorum and pass thresholds, and the aggregate-result publication commitment. Per-wallet vote choices and activation-time balances are operator-internal in v0; this section should reflect that.
9. **Execution plan** — if it passes, exactly what the operator does within the 14-day execution window. Code paths, on-chain transactions, or config changes.
10. **How to vote** — the URL to vote at (`/governance/proposal/<id>`) once active.

## Lifecycle states

A proposal moves through these states. The current state is reflected in the frontmatter `status` field; transitions are recorded as a one-line entry in a "Lifecycle" section at the bottom of the file.

```
   draft ──▶ active ──▶ closed ──▶ executed
     │         │          │
     │         │          └─▶ failed (no quorum, or NO threshold)
     │         └─▶ withdrawn (proposer cancels before activation)
     └─▶ rejected (operator scope review)
```

## Review

- Drafts are reviewed by the operator within 7 days for scope and clarity.
- Scope-rejected drafts get a written `rejected` status with a one-paragraph reason appended.
- Drafts that pass review are activated: status → `active`, voting window is set to 7 days. Activation-time vote-weight basis (per-wallet $MAGPIE balance) is captured by the operator and not published.

## Post-execution requirements

A passing-and-executed proposal must have:
- The execution transaction signature, code commit SHA, or config-change PR linked at the bottom.
- A 1-paragraph retrospective added 30 days after execution describing observed effects vs predicted effects.

This last bit matters more than people think. Predictions that don't survive contact with reality teach us how to write better proposals.

---

See [`GOVERNANCE.md`](../GOVERNANCE.md) for the underlying governance model. Open the first active proposal at [magpie.capital/governance](https://www.magpie.capital/governance).
