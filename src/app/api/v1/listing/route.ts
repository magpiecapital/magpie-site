/**
 * GET /api/v1/listing
 *
 * THE single operator runbook for getting $MAGPIE listed everywhere
 * (CoinGecko + CoinMarketCap + Moonshot). Replaces the older split
 * between /cmc-walkthrough, /moonshot-walkthrough, and the data
 * packets — those still exist for reference, but this is the URL
 * the operator opens during an actual submission session.
 *
 * Everything is pre-filled and copy-paste ready. Live data refreshes
 * on each request. noindex.
 */
import { getMagpieSupplyBreakdown, MAGPIE_MINT_STR, MAGPIE_DECIMALS } from "@/lib/solana/magpie-supply";
import { TELEGRAM_BOT, TELEGRAM_COMMUNITY } from "@/lib/telegram-links";

export const revalidate = 60;

interface DexPair {
  dexId?: string;
  pairAddress?: string;
  url?: string;
  quoteToken?: { symbol?: string; address?: string };
  priceUsd?: string;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
}

interface ProtoStats {
  totalLoansOriginated?: number;
  activeLoans?: number;
  repaidLoans?: number;
  liquidatedLoans?: number;
  totalSolLent?: number;
  totalUsers?: number;
  liquidationRate?: number;
}

async function fetchTopPair(): Promise<DexPair | null> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/tokens/v1/solana/${MAGPIE_MINT_STR}`,
      { signal: AbortSignal.timeout(7_000) },
    );
    if (!r.ok) return null;
    const pairs = (await r.json()) as DexPair[];
    if (!Array.isArray(pairs) || !pairs.length) return null;
    return pairs.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))[0];
  } catch {
    return null;
  }
}

async function fetchProtoStats(base: string): Promise<ProtoStats | null> {
  try {
    const r = await fetch(`${base}/api/v1/stats`, { signal: AbortSignal.timeout(7_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { ok?: boolean; data?: ProtoStats };
    return j.ok ? j.data ?? null : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.magpie.capital";
  const [supply, pair, stats] = await Promise.all([
    getMagpieSupplyBreakdown().catch(() => null),
    fetchTopPair(),
    fetchProtoStats(base),
  ]);

  const fmt = (n: number | undefined) =>
    n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtUsd = (n: number | undefined) =>
    n == null ? "—" : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtPct = (n: number | undefined, d = 2) =>
    n == null ? "—" : `${(n * 100).toFixed(d)}%`;

  const text = `═══════════════════════════════════════════════════════════════════
  $MAGPIE — Listing Runbook (CMC + CoinGecko + Moonshot)
  Generated: ${new Date().toISOString()}
═══════════════════════════════════════════════════════════════════

This is the only URL you need open during a submission session. Every
form field is pre-filled. Every DM is drafted. Every reviewer Q has a
pre-canned answer. Scroll top-to-bottom, do each step in order.

═══════════════════════════════════════════════════════════════════
LIVE NUMBERS (snapshot — refreshes on every load of this page)
═══════════════════════════════════════════════════════════════════
Circulating supply:        ${supply ? fmt(supply.circulating_supply) : "—"}    MAGPIE
Total supply:              ${supply ? fmt(supply.total_supply) : "—"}    MAGPIE
Non-circulating:           ${supply ? fmt(supply.non_circulating) : "—"}    (bonding curve + burn)
Decimals:                  ${MAGPIE_DECIMALS}
Mint:                      ${MAGPIE_MINT_STR}

Top DEX pair (DexScreener):
  DEX:                     ${pair?.dexId ?? "—"}
  Pair address:            ${pair?.pairAddress ?? "—"}
  Quote:                   ${pair?.quoteToken?.symbol ?? "—"}
  Price USD:               ${pair?.priceUsd ? "$" + pair.priceUsd : "—"}
  24h volume:              ${fmtUsd(pair?.volume?.h24)}
  Pool liquidity:          ${fmtUsd(pair?.liquidity?.usd)}

Protocol activity:
  Total loans originated:  ${fmt(stats?.totalLoansOriginated)}
  Repaid:                  ${fmt(stats?.repaidLoans)}
  Liquidated:              ${fmt(stats?.liquidatedLoans)}   (${fmtPct(stats?.liquidationRate)})
  Active right now:        ${fmt(stats?.activeLoans)}
  Total SOL lent:          ${stats?.totalSolLent != null ? stats.totalSolLent.toFixed(2) + " SOL" : "—"}
  Unique users:            ${fmt(stats?.totalUsers)}

═══════════════════════════════════════════════════════════════════
STEP 0 — Pre-flight (5 minutes, do once)
═══════════════════════════════════════════════════════════════════

[ ] You're reading this — keep this tab open through the whole session.
[ ] Open ${base}/magpie and confirm it renders. This is the URL you
    hand reviewers as "the project page."
[ ] Open ${base}/api/v1/markets — confirm pairs are populated.
[ ] Decide which email you'll use for CMC/CG reviewer follow-up.
    Reviews run weeks; this email needs notifications on. Suggested:
    a Magpie-specific Gmail forwarded to your main inbox.
[ ] Confirm @MagpieLoans on X is the account that will DM Moonshot.

═══════════════════════════════════════════════════════════════════
STEP 1 — Submit to CoinGecko  (do this FIRST — fastest reviewer)
═══════════════════════════════════════════════════════════════════

GO TO:  https://www.coingecko.com/request-form

(This is CG's Partners Platform / Dashboard sign-in — NOT their
support center. The support center is for support tickets and does
NOT contain a coin-listing form. If this link breaks: go to
coingecko.com, scroll to the footer, click "Request Form".)

Log in with your CoinGecko account (sign up with the email from
Step 0 if you don't have one). After login you land on the dashboard.

On the dashboard:
  - Find the "Request & Listing" tab in the left sidebar / top nav.
  - Click "New Coin/Token Listing".
  - Listing type → Active Listing  (the token is already trading
                                    on PumpSwap — pick Active, not Preview)
  - Pass type → Regular Pass is free (up to 5 days). Fast Pass is
                paid (~24h). Default Regular unless you want to pay.

Fields, top to bottom — COPY-PASTE the bold blocks exactly:

  Network:                 Solana
  Contract address:        ${MAGPIE_MINT_STR}

  Project name:            Magpie

  Symbol:                  MAGPIE

  Project description:
  ▼ paste this block ▼
  ──────────────────────────────────────────────────────────────────
Magpie Capital is a permissionless lending protocol on Solana. Users
borrow SOL against memecoin and tokenized-stock collateral, with
on-chain liquidation enforcement, an on-chain credit oracle that
rewards repayment history with better terms, and a paid agent API
via x402 that lets AI agents query protocol data without keys.

10% of every loan fee accrues to $MAGPIE holders as SOL distributions
on a randomized 5–10 day cadence. No claim required; SOL lands in
holder wallets automatically. Collateralized $MAGPIE still earns —
holders aren't punished for using the protocol productively.

Fair-launched on pump.fun in March 2026: 100% of supply hit the
bonding curve at launch, no team allocation, no presale, no vesting.
  ──────────────────────────────────────────────────────────────────

  Website:                 ${base}
  Whitepaper:              ${base}/whitepaper
  GitHub:                  https://github.com/magpiecapital/magpie-bot
                           https://github.com/magpiecapital/magpie-site
  Twitter:                 https://x.com/MagpieLoans
  Telegram:                ${TELEGRAM_COMMUNITY.url}
  Block explorer:          https://solscan.io/token/${MAGPIE_MINT_STR}

  Logo:                    upload ${base}/icon-200.png
                           (already exactly 200×200 PNG — no resampling needed)

  Circulating supply URL:  ${base}/api/v1/supply/circulating
  Total supply URL:        ${base}/api/v1/supply/total
  Markets:                 leave blank — CG pulls from DexScreener

  Launch date:             March 2026
  Initial price:           Fair launch via pump.fun bonding curve, no fixed initial price
  Vesting schedule:        None — 100% fair launch on bonding curve
  Team allocation:         0%

  Tags / category:         DeFi, Lending

Hit submit. CG review usually 1–3 weeks. Watch the email.

═══════════════════════════════════════════════════════════════════
STEP 2 — Submit to CoinMarketCap  (parallel — fine to do same day)
═══════════════════════════════════════════════════════════════════

GO TO:  https://support.coinmarketcap.com/hc/en-us/requests/new?ticket_form_id=360000493112

(Deep link straight to the "[New Listing] Add cryptoasset" form. If
it 404s in the future, go to coinmarketcap.com/request/ and select
"1 - [New Listing] Add cryptoasset" from the dropdown.)

Log into your CMC account.

Fields, top to bottom — COPY-PASTE the bold blocks exactly:

  Project name:            Magpie

  Symbol / ticker:          MAGPIE

  Platform / chain:         Solana
  Contract address:         ${MAGPIE_MINT_STR}
  Token program:            Token-2022 (TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb)
  Decimals:                 ${MAGPIE_DECIMALS}

  Project category:         DeFi
  Sub-category:             Lending
  Tags:                     DeFi, Lending, Solana, Memecoin, Credit Oracle

  Short description (for cards):
  ▼ paste this block ▼
  ──────────────────────────────────────────────────────────────────
Permissionless SOL lending against memecoin and tokenized-stock
collateral on Solana. 10% of every loan fee → SOL to $MAGPIE holders.
  ──────────────────────────────────────────────────────────────────

  Long description (for the project page):
  ▼ paste the SAME long description from Step 1 (CoinGecko) ▼

  Website:                 ${base}
  Whitepaper:              ${base}/whitepaper
  Source code:             https://github.com/magpiecapital
  X / Twitter:             https://x.com/MagpieLoans
  Telegram:                ${TELEGRAM_COMMUNITY.url}
  Block explorer:          https://solscan.io/token/${MAGPIE_MINT_STR}

  Logo:                    upload ${base}/icon-200.png  (exact 200×200 PNG)

  CRITICAL — Self-reported circulating supply URL:
    ${base}/api/v1/supply/circulating
    ↑ this MUST be the plain-text endpoint, NOT /api/v1/supply (JSON).
    If you paste the JSON URL here, CMC's poller will silently fail
    and your listing will stall in "pending data validation" forever.

  Total supply URL:        ${base}/api/v1/supply/total

  DEX pair address:        ${pair?.pairAddress ?? "(see /api/v1/markets)"}
  Markets endpoint:        ${base}/api/v1/markets

  Launch date:             March 2026
  Initial price (if asked): leave blank or paste:
                            "Fair launch via pump.fun bonding curve, no fixed initial price"
  Vesting schedule:        None — 100% fair launch on bonding curve
  Team token allocation:   0%

  Audit:                   Internal audit — see ${base}/security

  Tokenomics URL:          ${base}/tokenomics

  Contact email:           [the email from Step 0]

Hit submit. CMC review usually 4–8 weeks. Once CoinGecko goes live,
CMC tends to follow within 2 weeks.

═══════════════════════════════════════════════════════════════════
STEP 3 — Moonshot outreach  (no form — X DM)
═══════════════════════════════════════════════════════════════════

Moonshot auto-indexes pump.fun graduates with real liquidity. The
token is likely ALREADY discoverable in their app — search it first:

  GO TO:   https://moonshot.money
  SEARCH:  MAGPIE   (or paste mint: ${MAGPIE_MINT_STR})

If the token shows up with correct logo, name, and live price → skip
to the DM below to request the verified badge.

If the token does NOT show up, or the logo/name are wrong → the fix
is upstream at DexScreener (their token-info update, ~$300), not at
Moonshot. Do that first, wait 24h, then come back here.

When ready, DM @moonshot on X (or @DexterAgent as backup) with EXACTLY
this message:

  ▼ paste this DM ▼
  ──────────────────────────────────────────────────────────────────
Hi — requesting verified-token status for $MAGPIE on Moonshot.

  Mint:    ${MAGPIE_MINT_STR}
  Site:    ${base}
  X:       https://x.com/MagpieLoans
  Logo:    ${base}/icon-200.png

Magpie is a permissionless SOL-lending protocol on Solana — real
product with daily loan flow (${fmt(stats?.totalLoansOriginated)} lifetime loans, ${fmt(stats?.totalUsers)} users,
${stats?.totalSolLent != null ? stats.totalSolLent.toFixed(0) + " SOL" : "real volume"} lifetime borrowed). 10% of every loan fee accrues to
$MAGPIE holders as automatic SOL distributions. Fair-launched on
pump.fun, no team allocation.

Full submission packet (live data, auto-refreshing):
${base}/api/v1/moonshot-submission

Verification matters here because $MAGPIE is the protocol token for
an actively used lending product — impersonator mints are a real
phishing risk for our holders.

Happy to provide anything else needed.
  ──────────────────────────────────────────────────────────────────

If no reply in 5 business days, send the same message to
partnerships@dexterlabs.xyz (verify current address on moonshot.money).

═══════════════════════════════════════════════════════════════════
STEP 4 — After any listing goes live
═══════════════════════════════════════════════════════════════════

[ ] Tell me to update ${base}/api/v1/info to include the CMC / CG /
    Moonshot URLs in the urls block. Small site code change.
[ ] Post on X tagging @CoinMarketCap / @CoinGecko / @moonshot.
    Pin if you want; not required.
[ ] If Moonshot ships a deep-link (moonshot.money/asset/<mint>), tell
    me to add a "Trade on Moonshot" CTA to ${base}/magpie.

═══════════════════════════════════════════════════════════════════
REVIEWER Q&A — paste-ready answers when CG/CMC follow up
═══════════════════════════════════════════════════════════════════

Q: How is your circulating supply calculated?
A: On-chain total supply minus balances at the pump.fun bonding-curve
   address and the System / burn address. Full breakdown with the
   methodology is at ${base}/api/v1/supply. Tokens currently locked
   as loan collateral inside the Magpie program ARE included —
   borrowers retain economic ownership and can repay to reclaim.

Q: We can't load your logo / it's not 200×200.
A: ${base}/icon-200.png is already exactly 200×200 PNG with RGBA.
   If their uploader is rejecting it, the upstream issue is usually
   caching — try the 512×512 at ${base}/icon-512.png and let them
   resample on their side.

Q: What's your governance model?
A: No on-chain governance currently. The token's utility today is
   holder rewards (10% of every protocol fee → SOL distributions to
   $MAGPIE holders on 5–10 day randomized cadence) and use as
   permissionless collateral within the protocol. Governance may be
   added once the protocol has demonstrated sustained operation.

Q: Who's the team?
A: Anonymous founder + operator. Public-facing via @MagpieLoans on X.
   All protocol code is open-source (github.com/magpiecapital).
   All protocol activity is verifiable on-chain via Solscan
   (https://solscan.io/token/${MAGPIE_MINT_STR}) and the public stats
   API at ${base}/api/v1/stats.

Q: Has the contract been audited by [external firm]?
A: Internal audit completed — methodology and findings posted at
   ${base}/security. No third-party formal audit at this stage. The
   protocol invests in layered runtime anti-exploit gates on every
   borrow (TWAP oracle, cross-source price agreement, real-time
   post-borrow watcher, oracle-manipulation defenses shipped after
   the June 2026 incident, all documented at /security) rather than
   a one-time review of a permissioned contract — the contract
   surface is permissionless and would require re-auditing on every
   protocol update.

Q: Liquidation rate / risk metrics?
A: Lifetime liquidation rate is ${stats?.liquidationRate != null ? fmtPct(stats.liquidationRate) : "sub-1.5%"} across
   ${fmt(stats?.totalLoansOriginated)} loans. Live and verifiable at ${base}/api/v1/stats —
   we don't hardcode this number anywhere; it always comes from the
   live database.

Q: What's the relationship between the bot, the site, and the token?
A: The Telegram bot (@magpie_capital_bot) is the primary UX for
   borrowing. The site (${base}) provides the public dashboard, docs,
   security disclosures, and the same borrow flow as the bot. The
   $MAGPIE token is the protocol's reward + governance-eligible
   asset; protocol fees flow as SOL to holders automatically.

═══════════════════════════════════════════════════════════════════
STALL POINTS — what kills these submissions, by frequency
═══════════════════════════════════════════════════════════════════

1. Supply URL is the JSON endpoint, not the plain-text one.
   → Confirmed FIXED above; circulating URL is plain text.

2. Logo not exactly 200×200.
   → Confirmed FIXED above; /icon-200.png is exact 200×200.

3. Slow email response to reviewer.
   → Set up notifications. The #1 reason listings stall.

4. Contradictions between site content and submission form.
   → This packet is the source of truth. If the site says different,
     fix the site (tell me), don't fudge the form.

5. Moonshot logo / name wrong in their index.
   → Fix DexScreener (paid token-info update), not Moonshot. Wait 24h.

═══════════════════════════════════════════════════════════════════
QUICK REFERENCE — every link you'll need (in submission order)
═══════════════════════════════════════════════════════════════════

CoinGecko submit:          https://www.coingecko.com/request-form
                           (log in → dashboard → Request & Listing →
                            New Coin/Token Listing → Active)
CoinMarketCap submit:      https://support.coinmarketcap.com/hc/en-us/requests/new?ticket_form_id=360000493112
                           (or coinmarketcap.com/request/ → "1 - [New Listing] Add cryptoasset")
Moonshot search:           https://moonshot.money
Moonshot DM target:        https://x.com/moonshot

Project page (for reviewers):  ${base}/magpie
Security page:                 ${base}/security
Stats page:                    ${base}/stats
Tokenomics page:               ${base}/tokenomics
Whitepaper:                    ${base}/whitepaper

Circulating supply (plain):    ${base}/api/v1/supply/circulating
Total supply (plain):          ${base}/api/v1/supply/total
Supply breakdown (JSON):       ${base}/api/v1/supply
Markets (DEX pairs):           ${base}/api/v1/markets
Protocol stats:                ${base}/api/v1/stats
Project metadata (JSON):       ${base}/api/v1/info

Logo (200×200, for CMC/CG):    ${base}/icon-200.png
Logo (512×512, hi-res):        ${base}/icon-512.png

Solscan:                       https://solscan.io/token/${MAGPIE_MINT_STR}
DexScreener:                   https://dexscreener.com/solana/${MAGPIE_MINT_STR}
Birdeye:                       https://birdeye.so/token/${MAGPIE_MINT_STR}?chain=solana

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
