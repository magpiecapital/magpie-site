/**
 * GET /api/v1/moonshot-walkthrough
 *
 * Operator-facing step-by-step guide for getting $MAGPIE properly
 * indexed and (ideally) verified/featured on the Moonshot trading
 * app (moonshot.money / Dexter Labs). Companion to
 * /api/v1/moonshot-submission, which is the data packet; this is
 * the procedure.
 *
 * noindex.
 */
import { TELEGRAM_BOT } from "@/lib/telegram-links";

export const revalidate = 3600;

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.magpie.capital";
  const text = `═══════════════════════════════════════════════════════════════════
  $MAGPIE — Moonshot Listing Walkthrough
═══════════════════════════════════════════════════════════════════

This is the procedure, in order. Pair it with the data packet:
  ${base}/api/v1/moonshot-submission

Moonshot is a trading app — not an aggregator like CMC/CG. Their
review optimizes for "is this a tradeable, non-rug token with real
volume and a real story" rather than tokenomics depth. The angle
and the order are different from the CMC track; follow this runbook
instead of reusing the CMC one.

───────────────────────────────────────────────────────────────────
STEP 0 — Pre-flight (do once, before reaching out)
───────────────────────────────────────────────────────────────────

[ ] Open ${base}/api/v1/moonshot-submission — keep tab open the
    whole session.
[ ] Open https://moonshot.money and search "MAGPIE" / paste the mint.
    Moonshot auto-indexes pump.fun graduates with real liquidity, so
    the token is likely ALREADY discoverable. Confirm:
      - Token appears in search.
      - Price + 24h volume render.
      - Logo renders (if not, that's a Step 1 fix).
    If the token does NOT appear, the issue is almost certainly
    liquidity-threshold — verify ${base}/api/v1/markets returns
    pairs with nonzero 24h volume on a recognized DEX.
[ ] Open ${base}/api/v1/markets — confirm Raydium / PumpSwap pairs
    are populated with nonzero 24h volume.
[ ] Open ${base}/magpie — confirm renders cleanly. This is the URL
    Moonshot reviewers / DMs will land on.
[ ] Confirm ${base}/icon-200.png loads and is exactly 200×200 PNG.
    Moonshot uses smaller cards than CMC; the 200×200 is the right
    asset.
[ ] Decide which X account does the outreach. Moonshot replies via
    X DM more than email — use @MagpieLoans.

───────────────────────────────────────────────────────────────────
STEP 1 — Confirm auto-index is correct (do nothing if it is)
───────────────────────────────────────────────────────────────────

If the token already appears in Moonshot search with:
  - correct symbol (MAGPIE)
  - correct name (Magpie)
  - logo visible
  - 24h volume + price live
  - links populated (X / TG / site)

…then there is NO submission step. Moonshot pulled this from
DexScreener + pump.fun metadata. Skip to Step 2 (verified badge)
or Step 3 (featured / partnership outreach) directly.

If any of those are wrong:

  Wrong logo:                Moonshot is pulling the pump.fun-default
                             logo or a stale aggregator. The fix is
                             upstream — DexScreener "Update token info"
                             (paid, ~\$300) is the canonical path that
                             propagates to most downstream apps incl.
                             Moonshot. Don't DM Moonshot for this;
                             fix at source.

  Wrong name / symbol:       Almost always a Token-2022 metadata issue
                             at the mint. Check ${base}/api/v1/info
                             vs what shows on Solscan token page.
                             Fix metadata extension, not Moonshot.

  Missing socials:           DexScreener token-info update covers this
                             too. Once DS shows correct links, Moonshot
                             usually re-syncs within ~24h.

  Token not indexed at all:  Volume / liquidity threshold not met.
                             No amount of DM-ing fixes this — surface
                             the pool, drive volume, re-check in 48h.

───────────────────────────────────────────────────────────────────
STEP 2 — Apply for verified / blue-check badge
───────────────────────────────────────────────────────────────────

Moonshot's verified-token program is the rough equivalent of a
"this is the real token, not a phishing clone" badge. It mostly
matters because impersonator tokens are common on Solana and the
badge keeps holders from mis-routing.

There is no single public form — entry point is one of:

  a) DM @moonshot or @DexterAgent on X with the request.
     (Moonshot team responds here; faster than email.)
  b) Email partnerships@dexterlabs.xyz (confirm current address on
     moonshot.money — they move it) with the data packet.

What to paste in the first message (keep it short, they triage):

  Subject:  $MAGPIE — verification request (Solana, mint <paste>)

  Body:
    Hi — requesting verified-token status for $MAGPIE on Moonshot.

    - Mint: <paste from packet>
    - Site: ${base}
    - X: https://x.com/MagpieLoans
    - Telegram: ${TELEGRAM_BOT.url}
    - Full submission packet (auto-refreshing, live data):
        ${base}/api/v1/moonshot-submission

    Magpie is a permissionless SOL-lending protocol on Solana —
    real product, daily loan flow, 10% of every loan fee accrues
    to $MAGPIE holders as SOL distributions. Fair-launched on
    pump.fun, no team allocation.

    Verification matters here because $MAGPIE is the protocol token
    for an actively used lending product — impersonator mints are
    a real phishing risk for our holders.

    Happy to provide anything else needed.

That's it. Don't paste the whole packet inline — link it. They
will open the URL.

───────────────────────────────────────────────────────────────────
STEP 3 — Featured / partnership outreach (optional, after verified)
───────────────────────────────────────────────────────────────────

Once verified, the upside-tier ask is featured placement in the
Moonshot app — surfaced cards, trending highlight, or a partnership
push around a specific catalyst.

Best done after a concrete event the partnerships team can ride:
  - A protocol milestone (e.g. lifetime SOL borrowed crosses a
    round number — pull the live figure from ${base}/api/v1/stats).
  - A new collateral category live (e.g. tokenized stocks).
  - A coordinated holder-rewards milestone.

What makes this land vs. get ignored:

  - Lead with NUMBERS, not vibes. Pull from ${base}/api/v1/stats
    and ${base}/api/v1/info. Specific volume / fee / holder numbers.
  - Offer reciprocal: $MAGPIE → Moonshot in any marketing the
    protocol does (X pinned, blog, /magpie page).
  - One concrete ask. Not "let's partner" — "feature $MAGPIE in
    your trending row for the week of <date>."

───────────────────────────────────────────────────────────────────
STEP 4 — After verification / feature goes live
───────────────────────────────────────────────────────────────────

[ ] Add Moonshot to ${base}/api/v1/info under urls.exchange or
    a comparable aggregator field (small site code change).
[ ] If a Moonshot trade-link or deep-link is available
    (moonshot.money/asset/<mint> or similar), add it to ${base}/magpie
    as a "Trade on Moonshot" CTA. Keep the existing pump.fun /
    Jupiter links — additive, not replacing.
[ ] Post on X tagging @moonshot. Pin the announcement only if
    it's also tied to a protocol milestone, otherwise let it sit
    as a regular post.

───────────────────────────────────────────────────────────────────
STALL POINTS — what kills Moonshot outreach
───────────────────────────────────────────────────────────────────

1. Token has the wrong logo / name / socials in Moonshot's index.
   Cause: stale DexScreener-side metadata. Don't ask Moonshot to
   fix it — fix DexScreener (paid token-info update), then wait.

2. No response to DM.
   Moonshot team is small. If 5+ business days pass with no reply,
   try the email path. If still no reply, ride the next protocol
   catalyst and re-send with that as the hook.

3. Pitching tokenomics depth.
   Moonshot reviewers care about volume + liquidity + holder
   distribution + a clean story. Long tokenomics emails get
   skimmed. The 1-paragraph pitch in the data packet is calibrated
   for this audience — use that, not the CMC long-description.

4. Asking for verification before there's real activity.
   If 24h volume is thin or the pool is fresh, the verified ask
   reads as premature. Wait for the protocol to have at least a
   few weeks of sustained loan flow visible at ${base}/stats.

5. Volume / liquidity below the auto-index threshold.
   No DM fixes this — the threshold is mechanical. Surface the
   pool, drive volume, retry. ${base}/api/v1/markets is the
   ground truth.

═══════════════════════════════════════════════════════════════════
`;

  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
}
