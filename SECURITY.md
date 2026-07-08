# Security Policy

Magpie Capital is a lending protocol on Solana. We take the security of the
protocol and its users seriously. This document explains how to report a
vulnerability and the current status of our independent security review.

## Reporting a vulnerability

If you believe you have found a security vulnerability in any Magpie Capital
repository, program, or service, please report it privately. **Do not open a
public issue, pull request, or disclosure for a suspected vulnerability.**

- Preferred: open a private report via the **Security** tab of the affected
  repository ("Report a vulnerability" — GitHub private vulnerability reporting).
- Alternatively, use the contact path at **https://magpie.capital/security**.

Please include:

- a description of the issue and its potential impact,
- step-by-step reproduction details or a proof of concept,
- the affected component, program ID, transaction signatures, or addresses
  where relevant.

We aim to acknowledge new reports within **24 hours** and will keep you updated
as we investigate. We support coordinated, responsible disclosure and ask that
you give us a reasonable opportunity to remediate before any public disclosure.
We will not pursue or support legal action against good-faith security research
conducted in line with this policy.

## Audits in progress

Magpie's smart-contract audit process is **actively underway**. After
evaluating multiple Solana-native and cross-chain security firms, **Sec3
(formerly Soteria) has been engaged to audit Magpie V4**, and **audit
activities commenced on Wednesday, July 8, 2026**. Reports will be published
when complete. The protocol is **not yet audited** — please do not treat the
absence of a published report as a completed review.

| Firm | Engagement status |
| --- | --- |
| **Sec3** | **Engaged — auditing V4. Audit commenced July 8, 2026; review in progress.** Scope: the V4 on-chain program (`magpiecapital/magpie-v4`). |

Audits of the remaining on-chain programs (V3, then V1) will follow. Other
Solana-native and cross-chain firms were evaluated during selection.

The audit-target program, `magpiecapital/magpie-v4`, is kept **private** during
review, and the engaged firm is granted **read-only** access.

Completed reports will be published at:
**https://github.com/magpiecapital/audits**

## Scope

This policy applies to Magpie Capital's public repositories
(`magpie-bot`, `magpie-site`, `magpie-x402`) and to the protocol's on-chain
lending programs. The on-chain program is the final authority on protocol
behavior; off-chain services defer to it.

---

_This policy is maintained as a single source of truth and updated across all
Magpie surfaces together. Status: V4 audit underway with Sec3 (commenced July 8, 2026) · further
programs to follow · report shared when complete._
