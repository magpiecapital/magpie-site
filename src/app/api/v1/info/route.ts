/**
 * GET /api/v1/info
 *
 * Project metadata in the shape CoinMarketCap & CoinGecko reviewers
 * expect during the listing process. Everything they'd otherwise
 * have to extract by hand from the website is here in one place.
 *
 * Public, cached.
 */
import { NextResponse } from "next/server";
import { MAGPIE_MINT_STR, MAGPIE_DECIMALS } from "@/lib/solana/magpie-supply";

export const revalidate = 300;

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.magpie.capital";
  return NextResponse.json(
    {
      ok: true,
      name: "Magpie",
      symbol: "MAGPIE",
      project_name: "Magpie Capital",
      description:
        "Magpie Capital is a permissionless lending protocol on Solana. Users borrow SOL against memecoin and tokenized-stock collateral with on-chain liquidation, an on-chain credit oracle, and a paid agent API via x402.",
      tagline: "Permissionless SOL loans against memecoin + tokenized-stock collateral.",
      category: "DeFi · Lending",
      tags: ["defi", "lending", "solana", "memecoin", "credit-oracle", "x402", "agent-native"],
      launch_date: "2026-03",
      platform: {
        name: "Solana",
        token_address: MAGPIE_MINT_STR,
        token_program: "Token-2022",
        decimals: MAGPIE_DECIMALS,
      },
      urls: {
        website: [base],
        whitepaper: [`${base}/whitepaper`],
        docs: [`${base}/docs`],
        security: [`${base}/security`],
        stats: [`${base}/stats`],
        token_page: [`${base}/magpie`],
        twitter: ["https://x.com/MagpieLoans"],
        telegram_bot: ["https://t.me/magpie_capital_bot"],
        telegram_community: ["https://t.me/MagpieTalk"],
        explorer: [
          `https://solscan.io/token/${MAGPIE_MINT_STR}`,
          `https://birdeye.so/token/${MAGPIE_MINT_STR}?chain=solana`,
          `https://dexscreener.com/solana/${MAGPIE_MINT_STR}`,
        ],
        source_code: [
          "https://github.com/magpiecapital/magpie-bot",
          "https://github.com/magpiecapital/magpie-site",
        ],
      },
      logo: {
        url: `${base}/icon-200.png`,
        url_512: `${base}/icon-512.png`,
        format: "PNG",
        dimensions: "200x200 (canonical for CMC); 512x512 available at url_512",
        background: "rounded-square cream, transparent outside the corner radius",
      },
      supply_endpoints: {
        circulating: `${base}/api/v1/supply/circulating`,
        total: `${base}/api/v1/supply/total`,
        breakdown_json: `${base}/api/v1/supply`,
        format: "plain text, decimals already applied (e.g. 999500000.123456)",
      },
      stats_endpoints: {
        protocol_stats_json: `${base}/api/v1/stats`,
        protocol_health_json: `${base}/api/v1/health`,
        live_activity_json: `${base}/api/v1/activity/public`,
      },
      contact: {
        twitter_dm: "https://x.com/MagpieLoans",
        telegram_dm: "https://t.me/magpie_capital_bot",
        support_tickets: `${base}/dashboard`,
      },
      generated_at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
