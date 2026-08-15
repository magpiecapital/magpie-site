# Platform vetting in the open: Arena Club (August 2026)

Magpie lends against tokenized collectibles. Before any platform's vaulted assets can
back a loan, it must pass one non-negotiable test — **the double-dip test**: while a
loan is open, can the borrower sell, trade, or ship the physical item without the
lender knowing? If yes, the platform isn't lendable, whatever its comps look like.

Our standard, precisely: collateral must be a **chain-native token, 1:1-bound to the
vaulted physical, that the owner can self-custody and a lender can lock — where the
platform cannot move the physical while the token is locked.** Collector Crypt and
Phygitals meet this today (burn-to-redeem: a locked token freezes the physical).

## Arena Club, applied

Arena Club is a genuinely impressive platform — free insured vaulting, AI+human
grading, major distribution (eBay, Yahoo) and team partnerships, and a six-figure
vaulted inventory. And it surprised us: **every vaulted slab does get a 1:1 blockchain
token** — a Polygon ERC-721 ("DPOC") at `0x8A76f02EEE2BAD9206F302FC0E230eb609e81801`,
minted on vaulting and burned on physical retrieval. We verified the contract and
token flow on-chain directly.

**Why it doesn't pass the bar yet:** the DPOC is fully platform-custodial. Per Arena
Club's own Terms and help docs, users never hold keys, no self-custody export exists,
and the platform retains control over transfer, storage and burning. The token mirrors
their internal system of record rather than controlling the asset. That means no
third party can take the token into custody or place an enforceable lock — so every
disposal path (sale, offer, auction, instant buyback, trade, retrieval) stays open
during a hypothetical loan. That is the double-dip scenario our standard exists to
exclude.

**What would change the answer:** self-custody export of the DPOC (making it a
standard NFT-collateral flow — the burn-gated redemption they already run is exactly
the right enforcement primitive), or a platform-level lien state that freezes disposal
on flagged items. The architecture is most of the way there; it's a product decision,
not a rebuild. If that day comes, we'd welcome it — more vaulted assets earning
on-chain utility is the whole point.

*All claims verified against primary sources (Arena Club ToS and help center, the
Polygon contract via public RPC, archived site snapshots) as of 2026-08-15. Magpie has
no relationship with Arena Club; this is our vetting standard applied in the open.*
