# Magpie Capital — Governance Model (v0)

How $MAGPIE holders influence protocol direction. This document is the canonical spec; the public-facing summary lives at [magpie.capital/governance](https://www.magpie.capital/governance).

This is a **v0 model**: off-chain signal voting, operator-honored within an explicit scope. It is designed to give holders meaningful influence over the levers that matter, without overpromising authority that the protocol cannot yet credibly hand over. It will evolve toward on-chain enforcement as the protocol demonstrates sustained operation.

---

## Philosophy

1. **$MAGPIE holders should have real signal on protocol direction**, not just buy-and-hold dividends.
2. **Scope must be narrow and explicit**, not vague. What's votable is enumerated; everything else is operator discretion.
3. **Operator commits to honor passing votes within scope.** Vetoing a passing vote within scope dissolves trust and is treated as a one-strike event the community can hold against future communications.
4. **The model evolves toward less operator discretion over time** — not the other way. v0 is signal voting; v1 will introduce parameter bounds the operator can no longer override; v2 will be on-chain enforcement.

---

## Voting Power

- **Eligible holders:** any wallet holding $MAGPIE at the proposal's snapshot Solana slot.
- **Voting weight:** equal to the wallet's $MAGPIE balance at the snapshot slot (1 token = 1 vote).
- **Excluded addresses (do not vote):**
  - The pump.fun bonding curve address (now empty; reserved for completeness).
  - DEX pool token accounts (PumpSwap MAGPIE/SOL pool, Meteora MAGPIE/SOL pool, any future pools).
  - The Magpie protocol lender / operator wallet (`5hsZBr…` — operational liquidity, not governance constituency).
  - The system / burn address.
- **Why not quadratic / square-root weighting:** linear 1-token-1-vote is the simplest model holders can audit. The exclusion list handles the largest non-voter accounts (DEX pools). When voting power concentrates such that a single holder can pass any proposal alone, we revisit the weighting function.

---

## What's Votable (Scope)

### Tier A — operator commits to honor pass

| # | Topic | Bounds | Notes |
|---|-------|--------|-------|
| A1 | Add or remove a collateral token | Token must clear the screener's risk thresholds (oracle, liquidity, holder distribution). The vote is **whether** to add; the screener gates **eligibility**. | One token per proposal. |
| A2 | Adjust tier LTV cap | Within ±5 percentage points of the current value. Larger changes require a stand-alone proposal with explicit rationale. | Per tier (Express / Quick / Standard), one change per proposal. |
| A3 | Adjust tier fee rate | Within ±0.5 percentage points of the current value. | Per tier, one change per proposal. |
| A4 | Adjust holder distribution share | Within bounds 5% – 15% of loan fees (currently 10%). | Affects future loans only; cannot retroactively modify accrued distributions. |
| A5 | Adjust holder distribution cadence | Within bounds 3 – 14 days. | The randomized window stays — the proposal sets the min/max boundary of the window. |
| A6 | Non-binding signal poll on feature priorities | None — purely advisory. | Useful for ranking what to build next when multiple items compete. |

### Tier B — out of scope (operator discretion)

These cannot be put to a vote in v0. Listing them explicitly so the boundary is unambiguous.

- Anything that affects active loans retroactively (loan terms are a contract between borrower and protocol at borrow time).
- Anything compromising on-chain safety: security gauntlet config, oracle config, anti-exploit gates, post-borrow watcher logic.
- Founder identity, anonymity, or any operational security disclosure.
- Treasury / lender-wallet allocation (the lender wallet holds operational SOL liquidity, not governance funds).
- Token supply changes (mint authority is revoked; total supply is fixed).
- Pricing or scope of the x402 paid API.
- Personnel decisions (there is no team to govern).

### Tier C — escalation path

If the community wants to vote on a Tier B item, the path is:
1. A proposal explicitly requests moving the item from B to A.
2. The proposal must pass with **80% YES** and **15% quorum** (higher thresholds than Tier A) to take effect.
3. If passed, future Tier B → A migration takes effect after a 30-day cooling-off window during which the operator can publish concerns.

This is intentionally a high bar. Scope creep is the single biggest governance failure mode.

---

## Proposal Lifecycle

```
   draft ──▶ active ──▶ closed ──▶ executed
     │         │          │
     │         │          └─▶ failed (no quorum, or NO threshold)
     │         └─▶ withdrawn (proposer cancels before snapshot)
     └─▶ rejected (operator scope review)
```

### 1. Draft (community)

- Anyone can post a proposal idea in the @magpietalk community group.
- Proposer should provide: scope tier (A1–A6), exact change requested, rationale (≤500 words), expected protocol impact.
- The operator reviews drafts within 7 days. Scope-rejected drafts get a written reason and the draft remains visible — community can iterate.

### 2. Active (voting opens)

- Operator pins the proposal to `/governance` and to @magpietalk.
- A Solana slot is recorded as the snapshot slot.
- Voting opens for **7 days from the snapshot**.
- The voting interface at `/governance/proposal/[id]` allows any $MAGPIE holder to connect wallet and vote YES / NO / ABSTAIN. Vote is a wallet-signed message; signed payloads are stored off-chain and tally-verifiable by any third party.

### 3. Closed (vote ends)

- Tally is computed at 7 days after snapshot.
- **Quorum requirement:** at least 5% of circulating supply (excluding the exclusion list above) must have voted YES + NO (abstain doesn't count toward quorum).
- **Pass threshold:** 60% of (YES + NO) votes must be YES.
- If quorum fails OR pass threshold fails, the proposal is `failed`.

### 4. Executed (operator implements)

- Operator implements the passing change within 14 days of vote close.
- For changes that touch on-chain state, the implementation is a transaction or program update; signature is public.
- For configuration changes (off-chain): a commit to the relevant repo with the proposal ID in the commit message.

If the operator does not execute a passing Tier A vote within 14 days without publishing a written reason, this is logged as a governance failure event.

---

## How to Vote (v0 — off-chain signal)

1. Open https://www.magpie.capital/governance
2. Connect your Solana wallet
3. Find the active proposal
4. Click YES / NO / ABSTAIN
5. Your wallet signs a structured payload: `{proposal_id, vote, voter_pubkey, snapshot_slot, timestamp}`
6. The signed payload is recorded by the governance API
7. Anyone can audit the tally by replaying signed payloads against the on-chain snapshot

Voting is **gasless** (off-chain signed message, no Solana tx) and **anonymous** beyond the wallet pubkey.

---

## Roadmap

- **v0 (this doc) — off-chain signal voting, operator-honored.**
- **v1 — parameter bounds:** the operator deploys a configuration contract that enforces the Tier A bounds (LTV cap, fee bounds, holder share bounds, distribution cadence bounds). Changes outside the bounds become technically impossible without a new contract deploy.
- **v2 — on-chain governance:** SPL governance program or equivalent. Holders cast on-chain votes with token-weighted authority. Operator key authority transitions to multisig + governance.

No timeline commitments on v1 or v2. The model evolves when the protocol's track record warrants it.

---

## Audit + Verification

- **Live tally:** every proposal's tally is regenerable from the public snapshot slot + the off-chain signed-payload archive. Both are accessible via `/api/v1/governance`.
- **Snapshot integrity:** snapshot slots are published with the proposal; balances at that slot are auditable via any Solana RPC.
- **Operator commitment audit:** the operator publishes a quarterly governance report listing every proposal, its result, the execution action taken, and any deviations.

---

## Proposals

Each governance proposal is a Markdown file in [`/proposals`](./proposals/). See [`/proposals/README.md`](./proposals/README.md) for the file-naming convention, required frontmatter, required sections, and lifecycle states.

Drafted proposals at the time of v0 launch:

- [`MGP-001`](./proposals/MGP-001-holder-distribution-share-15pct.md) — Increase $MAGPIE holder fee share from 10% to 15%; LP share decreases from 80% to 75%. (Tier A4, draft.)
- [`MGP-002`](./proposals/MGP-002-extended-duration-tier-signal-poll.md) — Signal poll: should Magpie add an Extended-duration loan tier (≥14 days)? (Tier A6, draft.)

Subsequent proposal numbers are reserved for follow-ups (LTV adjustments per tier, fee-rate adjustments per tier, Tier C scope amendments).

## Questions / Concerns

- Open an issue at https://github.com/magpiecapital/magpie-site/issues
- Or post in @magpietalk

This is v0. The model is intended to evolve based on actual use. Suggested changes that improve the model (without weakening operator commitments) will be considered for incorporation in revisions.
