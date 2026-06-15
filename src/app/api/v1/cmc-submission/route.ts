/**
 * GET /api/v1/cmc-submission
 *
 * Operator-facing submission helper. Returns a plain-text document
 * with every CoinMarketCap / CoinGecko form field pre-filled with
 * live data from this site — so when the operator opens the listing
 * form they can copy-paste fields straight across instead of
 * gathering them by hand.
 *
 * Not linked from the public site. Discoverable to anyone who knows
 * the URL — content is non-sensitive (all data is also visible via
 * the other public endpoints), but a less-discoverable path keeps
 * search engines from indexing it as if it were a landing page.
 */
import { getMagpieSupplyBreakdown, MAGPIE_MINT_STR, MAGPIE_DECIMALS } from "@/lib/solana/magpie-supply";
import { TELEGRAM_BOT, TELEGRAM_COMMUNITY } from "@/lib/telegram-links";

export const revalidate = 60;

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.magpie.capital";
  let supplyBlock = "Supply data unavailable (RPC fetch failed).\nRetry shortly or check /api/v1/supply directly.";
  try {
    const s = await getMagpieSupplyBreakdown();
    const fmt = (n: number) =>
      n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    supplyBlock = [
      `Circulating supply:        ${fmt(s.circulating_supply)}`,
      `Total supply:              ${fmt(s.total_supply)}`,
      `Max supply:                ${fmt(s.total_supply)}    (Token-2022 — no future mints)`,
      `Non-circulating:           ${fmt(s.non_circulating)}    (bonding curve + burn)`,
    ].join("\n");
  } catch { /* keep fallback */ }

  const text = `═══════════════════════════════════════════════════════════════════
  $MAGPIE — CoinMarketCap / CoinGecko Submission Packet
  Generated: ${new Date().toISOString()}
═══════════════════════════════════════════════════════════════════

This is a copy-paste helper for the listing form. Every field below
maps to a question CMC or CoinGecko will ask. Live data pulls fresh
on every request.

───────────────────────────────────────────────────────────────────
BASIC INFO
───────────────────────────────────────────────────────────────────
Name:                      Magpie
Symbol:                    MAGPIE
Project name:              Magpie Capital
Category:                  DeFi · Lending
Tags:                      defi, lending, solana, memecoin, credit-oracle, x402, agent-native
Launch date:               March 2026  (Solana mainnet)
Status:                    Live on mainnet

───────────────────────────────────────────────────────────────────
DESCRIPTION (short, for cards)
───────────────────────────────────────────────────────────────────
Permissionless SOL lending against memecoin and tokenized-stock collateral on Solana.

───────────────────────────────────────────────────────────────────
DESCRIPTION (long, for the project page)
───────────────────────────────────────────────────────────────────
Magpie Capital is a permissionless lending protocol on Solana. Users
borrow SOL against memecoin and tokenized-stock collateral with
on-chain liquidation enforcement, an on-chain credit oracle that
rewards repayment history with better terms, and a paid agent API
via x402 that lets AI agents query protocol data without API keys.

70% of every loan fee accrues to $MAGPIE holders as SOL distributions
on a randomized 5–10 day cadence (per MGP-001, ratified 2026-06-13).
No claim required; SOL lands in holder wallets automatically.
Collateralized $MAGPIE still earns — holders aren't punished for
using the protocol productively.

Fair-launched on pump.fun: 100% of supply hit the bonding curve at
launch, no team allocation, no presale, no vesting cliffs.

───────────────────────────────────────────────────────────────────
CONTRACT
───────────────────────────────────────────────────────────────────
Network:                   Solana mainnet
Token program:             Token-2022 (TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb)
Mint address:              ${MAGPIE_MINT_STR}
Decimals:                  ${MAGPIE_DECIMALS}

───────────────────────────────────────────────────────────────────
SUPPLY (live — refresh on each form submission)
───────────────────────────────────────────────────────────────────
${supplyBlock}

Machine-readable feeds (paste these URLs directly into CMC / CoinGecko form fields):
  Circulating supply API:  ${base}/api/v1/supply/circulating
  Total supply API:        ${base}/api/v1/supply/total
  Full breakdown (JSON):   ${base}/api/v1/supply

───────────────────────────────────────────────────────────────────
LINKS
───────────────────────────────────────────────────────────────────
Website:                   ${base}
Token info page:           ${base}/magpie
Tokenomics:                ${base}/tokenomics
Whitepaper:                ${base}/whitepaper
Docs:                      ${base}/docs
Security / audit posture:  ${base}/security
Protocol stats:            ${base}/stats
Support:                   ${base}/support

X / Twitter:               https://x.com/MagpieLoans
Telegram bot:              ${TELEGRAM_BOT.url}
Telegram community:        ${TELEGRAM_COMMUNITY.url}

Source code (bot):         https://github.com/magpiecapital/magpie-bot
Source code (site):        https://github.com/magpiecapital/magpie-site

Explorers:
  Solscan:                 https://solscan.io/token/${MAGPIE_MINT_STR}
  DexScreener:             https://dexscreener.com/solana/${MAGPIE_MINT_STR}
  Birdeye:                 https://birdeye.so/token/${MAGPIE_MINT_STR}?chain=solana

───────────────────────────────────────────────────────────────────
LOGO
───────────────────────────────────────────────────────────────────
200×200 (canonical):       ${base}/icon-200.png   ← USE THIS FOR CMC
512×512 (high-res):        ${base}/icon-512.png

Both PNG, RGBA, rounded-square cream brand mark. The 200×200 was
resampled from the 512×512 — same image, scaled to CMC's required
listing-form size so reviewers don't reject for dimension.

───────────────────────────────────────────────────────────────────
MARKETS (DEX pairs — live from DexScreener)
───────────────────────────────────────────────────────────────────
JSON feed:                 ${base}/api/v1/markets

Sorted by 24h volume desc. Includes pair address, DEX (Raydium /
PumpSwap / etc.), quote token, last price USD, 24h volume USD,
and pool liquidity USD. Update freshness: 60s cache.

───────────────────────────────────────────────────────────────────
TEAM
───────────────────────────────────────────────────────────────────
Anonymous founder + operator. Public-facing handles:
  X:                       @MagpieLoans
  Operator contact:        DM @MagpieLoans on X, or open a ticket
                           at ${base}/support

No KYC team disclosure planned. If CMC requires identified team for
listing, accept the lower tier or unlisted-doxxed track.

───────────────────────────────────────────────────────────────────
TOKEN UTILITY
───────────────────────────────────────────────────────────────────
- Holder rewards: 10% of every loan fee → SOL distributions to
  $MAGPIE holders on randomized 5–10 day cadence.
- Collateral: $MAGPIE is one of the protocol's approved collateral
  tokens with an unlimited per-token cap (protocol's own token).
- Governance: not currently active. May be added once the protocol
  has demonstrated sustained operation.

───────────────────────────────────────────────────────────────────
PROJECT METADATA (JSON FEED)
───────────────────────────────────────────────────────────────────
For CG / CMC to auto-pull project metadata:
  ${base}/api/v1/info

───────────────────────────────────────────────────────────────────
SUBMISSION CHECKLIST
───────────────────────────────────────────────────────────────────
[ ] CoinGecko submitted     (typically reviewed faster than CMC)
[ ] CoinMarketCap submitted (paste circulating-supply API URL into
                             the "Self-reported circulating supply
                             URL" field)
[ ] Logo uploaded as 200×200 PNG (resampled from icon-512.png)
[ ] Contact email provided   (CMC will ask for an ops email that
                             survives weeks of review back-and-forth)
[ ] Markets URL included     (${base}/api/v1/markets)
[ ] Wait 4–8 weeks; respond promptly to any reviewer follow-up
    questions to avoid re-queueing.

═══════════════════════════════════════════════════════════════════
`;

  return new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, max-age=60",
      "X-Robots-Tag": "noindex",
    },
  });
}
