/**
 * GET /api/v1/cmc-walkthrough
 *
 * Operator-facing step-by-step guide for actually submitting the
 * listing. Reads like a runbook — the order to do things, what to
 * paste where, what to expect at each stage, and where the common
 * stalls happen. Companion to /api/v1/cmc-submission, which is
 * the form-fill data; this is the procedure.
 *
 * noindex.
 */
import { TELEGRAM_BOT, TELEGRAM_COMMUNITY } from "@/lib/telegram-links";

export const revalidate = 3600;

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.magpie.capital";
  const text = `═══════════════════════════════════════════════════════════════════
  $MAGPIE — Listing Submission Walkthrough
═══════════════════════════════════════════════════════════════════

This is the procedure, in order. Pair it with the data packet:
  ${base}/api/v1/cmc-submission

───────────────────────────────────────────────────────────────────
STEP 0 — Pre-flight (do this once, before submitting anywhere)
───────────────────────────────────────────────────────────────────

[ ] Open ${base}/api/v1/cmc-submission in a browser tab — keep it open
    for the entire submission session. Every field you need is in
    there.
[ ] Open ${base}/api/v1/supply in another tab — confirm circulating /
    total / non-circulating are non-zero and look reasonable.
[ ] Open ${base}/magpie — confirm the page renders. This is the URL
    you'll hand reviewers.
[ ] Open ${base}/api/v1/markets — confirm DEX pairs are populated
    (Raydium / PumpSwap / etc.). Empty markets array = no listing,
    so re-check DexScreener if this returns [].
[ ] Optional but recommended: resample /icon-512.png down to 200x200
    PNG for CMC's strict size requirement. Most image editors do this
    in one click.
[ ] Decide on a contact email for the submission. The review will
    last weeks; whoever owns the email needs to be reachable.

───────────────────────────────────────────────────────────────────
STEP 1 — Submit to CoinGecko FIRST
───────────────────────────────────────────────────────────────────

CoinGecko reviewers tend to be faster than CMC, and a successful CG
listing is a strong signal during CMC's review. Always start here.

  - Submission form: search CoinGecko's "submit a new coin" or
    "request a token listing" page (it moves around; their official
    support docs will have the current URL).
  - You'll create or log into a CG account if you don't have one.

Fields they'll ask, in roughly this order:

  Token name:                 paste "Name" from /api/v1/cmc-submission
  Symbol:                     MAGPIE
  Contract address:           paste mint from packet
  Network / chain:            Solana
  Project description:        paste the LONG description from packet
  Website:                    ${base}
  Whitepaper:                 ${base}/whitepaper
  GitHub:                     https://github.com/magpiecapital/magpie-bot
                              https://github.com/magpiecapital/magpie-site
  Twitter:                    https://x.com/MagpieLoans
  Telegram:                   ${TELEGRAM_BOT.url}
                              ${TELEGRAM_COMMUNITY.url}
  Block explorer:             https://solscan.io/token/<mint>
  Logo:                       upload /icon-512.png (resampled to 200x200)
  Circulating supply API:     ${base}/api/v1/supply/circulating
  Total supply API:           ${base}/api/v1/supply/total
  Markets:                    leave blank — CG pulls from DexScreener
                              directly via on-chain data
  Audit:                      link ${base}/security
                              (note: "internal audit, see page for findings")
  Team:                       "Anonymous founder/operator; public via
                              @MagpieLoans on X"

Submit. Expected timeline: 1-3 weeks for CG. Watch the email you
provided for reviewer questions.

───────────────────────────────────────────────────────────────────
STEP 2 — Submit to CoinMarketCap (parallel-track is fine)
───────────────────────────────────────────────────────────────────

CMC's self-listing form is at support.coinmarketcap.com — they
periodically restructure the support center so search their current
"Request Form" / "List Cryptoasset" article for the live URL.

Two key differences from CG:

  1. They specifically ask for "Self-reported circulating supply URL"
     — this MUST be the plain-text endpoint, not JSON:
     ${base}/api/v1/supply/circulating
     If you paste /api/v1/supply (JSON) here, it will silently fail.

  2. They want the markets question answered. Paste:
     ${base}/api/v1/markets
     and the top 1-2 pair addresses from that JSON into the "DEX
     pair address" field if there's one.

Fields not covered above:

  Project category:           DeFi / Lending
  Tags:                       DeFi, Lending, Solana, Memecoin, Credit Oracle
  Tokenomics URL:             ${base}/tokenomics
  Launch date:                March 2026
  Initial price (if asked):   leave blank or "fair launch via pump.fun
                              bonding curve, no fixed initial price"
  Vesting schedule:           "None — 100% fair launch on bonding curve"
  Team token allocation:      0%

Submit. Expected timeline: 4-8 weeks for CMC; sometimes faster after
CoinGecko goes live.

───────────────────────────────────────────────────────────────────
STEP 3 — Respond to reviewer follow-ups quickly
───────────────────────────────────────────────────────────────────

The #1 reason listing submissions stall is the reviewer asks a
clarifying question and the email sits unanswered for days. Set up
the contact email to forward to a channel you actively monitor (TG,
Slack, or your default inbox with notifications on).

Common questions and how to answer:

Q: "How is your circulating supply calculated?"
A: Point them at ${base}/tokenomics — methodology spelled out.
   Or ${base}/api/v1/supply for the JSON breakdown.

Q: "We can't load your logo / it's not 200x200."
A: Resample /icon-512.png to exactly 200x200 PNG with transparent
   background and re-upload. Don't argue size — just match exactly.

Q: "What's your governance model?"
A: "No governance token mechanism currently. May be added once the
   protocol has demonstrated sustained operation. The token's
   utility today is holder rewards (10% of every fee → SOL
   distributions to $MAGPIE holders on 5-10 day cadence)."

Q: "Who's the team?"
A: "Anonymous founder/operator. Public-facing via @MagpieLoans on X.
   Protocol is open-source (links provided), all on-chain activity
   verifiable via Solscan."

Q: "Has the contract been audited by [external firm]?"
A: "Internal audit (see /security). No third-party formal audit at
   this stage. Defense investment is in layered anti-exploit gates
   on every borrow (real-time post-borrow watcher, TWAP oracle,
   cross-source price agreement, etc) rather than a one-time review
   of a permissioned contract — the protocol's contract surface is
   permissionless and would re-audit on every update."

───────────────────────────────────────────────────────────────────
STEP 4 — After listings go live
───────────────────────────────────────────────────────────────────

[ ] Update ${base}/api/v1/info to include the CMC + CG URLs in the
    'urls.explorer' or 'urls.aggregator' array (small site code
    change). Reviewers and follow-on integrations will find this.
[ ] Add the CMC + CG widget badges to ${base}/magpie if you want
    them prominently displayed.
[ ] Announce on X — pin a tweet. Tag @CoinMarketCap and @CoinGecko.

───────────────────────────────────────────────────────────────────
STALL POINTS — what kills submissions
───────────────────────────────────────────────────────────────────

1. Supply endpoint returns JSON when CMC expects plain text.
   Fix: confirm /api/v1/supply/circulating returns just the number,
   no quotes, no extra text. Test with curl.

2. Logo not exactly 200x200.
   Fix: don't argue; resample exactly to spec.

3. Markets array is empty.
   Fix: check ${base}/api/v1/markets returns pairs. If it doesn't,
   DexScreener doesn't see the pool. Verify the LP exists on a
   recognized DEX (Raydium / PumpSwap / Orca) and has nonzero
   24h volume.

4. Slow email response.
   Fix: monitor the contact email aggressively for 8 weeks.

5. Contradictions between site content and submission form.
   Fix: this packet is the source of truth — if the site says
   something different, fix the site, then re-submit.

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
