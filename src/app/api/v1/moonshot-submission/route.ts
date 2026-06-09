/**
 * GET /api/v1/moonshot-submission
 *
 * Operator-facing submission packet for the Moonshot trading app
 * (moonshot.money / Dexter Labs). Trading-app reviewers care about
 * different things than CMC: DEX volume + liquidity + holder
 * distribution + short pitch, not deep tokenomics. This packet is
 * pre-filled in the order they typically ask.
 *
 * noindex.
 */
import { getMagpieSupplyBreakdown, MAGPIE_MINT_STR, MAGPIE_DECIMALS } from "@/lib/solana/magpie-supply";

export const revalidate = 60;

interface DexScreenerPair {
  dexId?: string;
  pairAddress?: string;
  url?: string;
  baseToken?: { address?: string; symbol?: string };
  quoteToken?: { address?: string; symbol?: string };
  priceUsd?: string;
  priceChange?: { h24?: number; h6?: number; h1?: number };
  volume?: { h24?: number; h6?: number; h1?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

async function fetchTopPair(): Promise<DexScreenerPair | null> {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/tokens/v1/solana/${MAGPIE_MINT_STR}`,
      { signal: AbortSignal.timeout(7_000) },
    );
    if (!r.ok) return null;
    const pairs = (await r.json()) as DexScreenerPair[];
    if (!Array.isArray(pairs) || !pairs.length) return null;
    return pairs.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))[0];
  } catch {
    return null;
  }
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.magpie.capital";
  const [supply, top] = await Promise.all([
    getMagpieSupplyBreakdown().catch(() => null),
    fetchTopPair(),
  ]);

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtUsd = (n: number | undefined) =>
    n == null ? "—" : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const text = `═══════════════════════════════════════════════════════════════════
  $MAGPIE — Moonshot Submission Packet
  Generated: ${new Date().toISOString()}
═══════════════════════════════════════════════════════════════════

For the Moonshot trading app (moonshot.money / Dexter Labs). Moonshot
auto-indexes pump.fun graduates with real liquidity, so the token may
already be discoverable in their search. This packet covers (a) the
listing-application form for verified-badge / featured status, and
(b) the data you'll quote in any DM / partnership outreach.

───────────────────────────────────────────────────────────────────
WHY $MAGPIE FOR MOONSHOT (the pitch — 1-paragraph version)
───────────────────────────────────────────────────────────────────
$MAGPIE is the protocol token for Magpie Capital — Solana's
permissionless lending protocol that lets users borrow SOL against
memecoins and tokenized stocks. Holders earn 10% of every loan fee
as automatic SOL distributions on a randomized 5-10 day cadence.
Fair-launched on pump.fun (March 2026), 100% on the bonding curve,
zero team allocation. Real protocol with daily loan volume, not just
a meme.

───────────────────────────────────────────────────────────────────
ONE-LINER (for catalog / search-result snippet)
───────────────────────────────────────────────────────────────────
The protocol token for Magpie Capital — Solana permissionless lending. 10% of every loan fee → SOL to $MAGPIE holders.

───────────────────────────────────────────────────────────────────
CONTRACT
───────────────────────────────────────────────────────────────────
Mint:                      ${MAGPIE_MINT_STR}
Network:                   Solana mainnet
Token program:             Token-2022 (extensions enabled)
Decimals:                  ${MAGPIE_DECIMALS}
Launch:                    March 2026 (pump.fun fair launch)

───────────────────────────────────────────────────────────────────
SUPPLY (live — refreshes on each request)
───────────────────────────────────────────────────────────────────
${supply ? [
    `Circulating:               ${fmt(supply.circulating_supply)}`,
    `Total:                     ${fmt(supply.total_supply)}`,
    `Non-circulating:           ${fmt(supply.non_circulating)} (bonding-curve / burn — typically 0 post-grad)`,
    `Max supply:                ${fmt(supply.total_supply)}  (Token-2022, no future mints)`,
  ].join("\n") : "(RPC unavailable — retry; or see /api/v1/supply)"}

───────────────────────────────────────────────────────────────────
TRADING — TOP DEX PAIR (live from DexScreener)
───────────────────────────────────────────────────────────────────
${top ? [
    `DEX:                       ${top.dexId ?? "—"}`,
    `Pair address:              ${top.pairAddress ?? "—"}`,
    `Quote token:               ${top.quoteToken?.symbol ?? "—"} (${top.quoteToken?.address ?? "—"})`,
    `Price USD:                 ${top.priceUsd ? "$" + top.priceUsd : "—"}`,
    `24h volume:                ${fmtUsd(top.volume?.h24)}`,
    `6h volume:                 ${fmtUsd(top.volume?.h6)}`,
    `1h volume:                 ${fmtUsd(top.volume?.h1)}`,
    `Liquidity (pool TVL):      ${fmtUsd(top.liquidity?.usd)}`,
    `24h price change:          ${top.priceChange?.h24 != null ? top.priceChange.h24.toFixed(2) + "%" : "—"}`,
    `Pair created:              ${top.pairCreatedAt ? new Date(top.pairCreatedAt).toISOString() : "—"}`,
    `DexScreener:               ${top.url ?? `https://dexscreener.com/solana/${MAGPIE_MINT_STR}`}`,
  ].join("\n") : "(DexScreener fetch failed — retry; or see /api/v1/markets)"}

All pairs:                 ${base}/api/v1/markets

───────────────────────────────────────────────────────────────────
TRADING SIGNALS REVIEWERS CARE ABOUT
───────────────────────────────────────────────────────────────────
Holder distribution:       see ${base}/api/v1/supply for breakdown
                           burn + bonding-curve excluded from circulating
Verifiable on-chain:       https://solscan.io/token/${MAGPIE_MINT_STR}
                           https://birdeye.so/token/${MAGPIE_MINT_STR}?chain=solana
LP burned / locked:        No (LP retained for protocol-managed
                           depth; not a rug risk — protocol's own
                           lender wallet maintains liquidity, not a
                           dev team)
Mint authority revoked:    Yes (post-graduation, pump.fun-standard)
Freeze authority revoked:  Yes

───────────────────────────────────────────────────────────────────
LINKS
───────────────────────────────────────────────────────────────────
Project home:              ${base}
Token info page:           ${base}/magpie
Tokenomics:                ${base}/tokenomics
Stats / metrics dashboard: ${base}/stats
Security:                  ${base}/security
Whitepaper:                ${base}/whitepaper

X / Twitter:               https://x.com/MagpieLoans
Telegram community:        https://t.me/magpiecapital_chat
Telegram bot (the app):    https://t.me/magpie_capital_bot

Source code:               https://github.com/magpiecapital

───────────────────────────────────────────────────────────────────
LOGO
───────────────────────────────────────────────────────────────────
200×200 (most aggregators):  ${base}/icon-200.png
512×512 (high-res):          ${base}/icon-512.png

───────────────────────────────────────────────────────────────────
WHAT MAKES THIS DIFFERENT FROM A TYPICAL PUMP.FUN GRADUATE
───────────────────────────────────────────────────────────────────
- Real protocol behind the token. Loan flow exists, runs daily,
  every fee documented on-chain at ${base}/stats.
- 10% of every protocol fee gets automatically distributed in SOL
  to $MAGPIE holders. No claim, no gas paid by holder, no expiry.
- Holders who actively use the protocol (borrow against their
  $MAGPIE) are NOT punished — collateralized $MAGPIE still earns.
- Live, layered anti-exploit gauntlet on every borrow (see
  ${base}/security) — not just an audit-once-and-forget contract.

These all hit harder for a Moonshot reviewer than tokenomics depth
would; lead with these.

───────────────────────────────────────────────────────────────────
CONTACT FOR FOLLOWUP
───────────────────────────────────────────────────────────────────
DM @MagpieLoans on X, or open a support ticket at ${base}/support.

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
