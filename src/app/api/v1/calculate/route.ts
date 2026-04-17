import { NextRequest, NextResponse } from "next/server";

/* ─── Constants ─── */
const SOL_MINT = "So11111111111111111111111111111111111111112";
const FEE_RATE = 0.015;

const TIERS: Record<string, { ltv: number; days: number }> = {
  express: { ltv: 0.3, days: 2 },
  quick: { ltv: 0.25, days: 3 },
  standard: { ltv: 0.2, days: 7 },
};

/* ─── Token Registry (64 approved tokens) ─── */
const REGISTRY: { symbol: string; name: string; mint: string }[] = [
  { symbol: "FARTCOIN", name: "Fartcoin", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump" },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr" },
  { symbol: "MOO DENG", name: "Moo Deng", mint: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY" },
  { symbol: "GOAT", name: "Goatseus Maximus", mint: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump" },
  { symbol: "PNUT", name: "Peanut the Squirrel", mint: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump" },
  { symbol: "MEW", name: "cat in a dogs world", mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5" },
  { symbol: "CHILLGUY", name: "Just a chill guy", mint: "Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump" },
  { symbol: "PENGU", name: "Pudgy Penguins", mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv" },
  { symbol: "ACT", name: "Act I: The AI Prophecy", mint: "GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump" },
  { symbol: "SPX", name: "SPX6900", mint: "J3NKxxXZcnNiMjKw9hYb2K4LUxgwB6t1FtPtQVsv3KFr" },
  { symbol: "GIGA", name: "Giga Chad", mint: "63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9" },
  { symbol: "MOODENG", name: "Baby Moo Deng", mint: "8bFiMRLQ2kBsLe9TFbMDJYBNGNrPFGRb87ipPMPR3Tup" },
  { symbol: "BUCK", name: "Buck", mint: "BxWBBBHqLdEfTTKNHPWFKGq3n5RY8kHDCkBH9KJXpump" },
  { symbol: "HOUSE", name: "House", mint: "E3UjYUoB3CWdMHkSfWpFH7V9j1x4Me5NJKFK6Mppump" },
  { symbol: "AI16Z", name: "ai16z", mint: "HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC" },
  { symbol: "WOULD", name: "Would", mint: "75DSVgBDEUPRQnJqKGBjMZaW72k2CEwjhsTrQMpfpump" },
  { symbol: "ROUTINE", name: "Routine", mint: "35F9cQg3jkDq3bYFNQBq1GqU7jQPNshLinBfVpnwpump" },
  { symbol: "VINE", name: "Vine Coin", mint: "6AJcP7wuLwmRYLBNbi825wgguaPsWzPBEHcHnd3EJXMJ" },
  { symbol: "TITCOIN", name: "Titcoin", mint: "HRs8WzyGHMBzCMEKVCmwREjpYMTYMGjEMLCmpVMpump" },
  { symbol: "RFC", name: "Retard Finder Coin", mint: "GByvk4yoKMotBim2t1ym2ZYNNMuZuMhfCJJDFRrgpump" },
  { symbol: "DARK", name: "Dark", mint: "5573MgVNGh9dFaoqPFCajHBPnLjTexUi6vjFvvhgpump" },
  { symbol: "ALCH", name: "Alchemist AI", mint: "HNg5PYJoQKSx9gKGAjKHSVG5DrJkpJJRBtECbpzpump" },
  { symbol: "BULLY", name: "Dolos The Bully", mint: "51KuEpFMDZaxGCSAcsdZMKZkfQMK2KRXE3G2gPpXpump" },
  { symbol: "KWEEN", name: "Kween", mint: "GceKqmDyFnFhTMzmRBgrafbF4LRaZJQtaJWz9dHpump" },
  { symbol: "LUCE", name: "LUCE", mint: "CBdCxKo9QavR9hfShgRMPg6mnaN2Hi7L7HPERTdpump" },
  { symbol: "SLOP", name: "Slop", mint: "8cMKnMkP6TtV5NKSHg89W7AEFwen6MFjFVE2VBYepump" },
  { symbol: "ANSEM", name: "Ansem", mint: "HiEDq2KbMF3JCzrMFAPVS9bEF4Lx1MtuoGPwvJxpump" },
  { symbol: "CATFISH", name: "Catfish", mint: "9P1T7BQLJqoWkemjaGTxLzDBMG2mTxjzSaMKmnsDpump" },
  { symbol: "PVS", name: "PVS", mint: "AdL1dFRczHDDVE3tPkjxbFGHqxs6GiLKfuFvNjpump" },
  { symbol: "SIGMA", name: "Sigma", mint: "5SVG3T9CNQsm1CtEjVJjMDdHwikkEMbCmo4VH5Bpump" },
  { symbol: "SWAG", name: "Swag", mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J1z" },
  { symbol: "BORK", name: "Bork", mint: "41SuGqiJqXEbNJn9TRWFSngvLmGUf7bTzNSyZjr6pump" },
  { symbol: "GUMMY", name: "Gummy", mint: "HF5iVVbV9rdoSF4SGUKLPRHsKzVhBJaqpvdCvpSUpump" },
  { symbol: "BEEP", name: "Beep", mint: "D8r8XTuCrUhLheWeGXSwC3G92RhASficV3YA7B2Vpump" },
  { symbol: "UBC", name: "Universal Basic Compute", mint: "9psiRdn9cXYVps4F1kFuoNjd2EtmqNJXrCPmRppJpump" },
  { symbol: "DNUT", name: "Deez Nuts", mint: "Hb1gKr8VSwvXRMWUTRN64PiYJYhXXZ96JFyNLRCpump" },
  { symbol: "SHOGGOTH", name: "Shoggoth", mint: "H1G6sZ1WDoMmMCFqBKAbg9gkQPCo1sKQtaJWz9dHpump" },
  { symbol: "SKIBIDI", name: "Skibidi Toilet", mint: "BZdLPF2jMNcFEfvPhtqkaeymCQtHCrKE46qQ43pKe8HCpump" },
  { symbol: "HAMMY", name: "Hammy", mint: "26VBfmUVxQ4i3ENqXjkk95sB9LPf5xzB1C4ECNnpump" },
  { symbol: "SCOOPY", name: "Scoopy", mint: "78F3Ln95cCfCC3K2zTDqWK9rMgzRYRLGLgZ7o7BEpump" },
  { symbol: "MICHI", name: "Michi", mint: "5mbK36SZ7J19An8jFochhQS4of8g6BwUjbeCSxBSoWdp" },
  { symbol: "RETARDIO", name: "Retardio", mint: "6ogzHhzdrQr9Pgv6hZ2MNze7UrzBMAFyBBWUYp1Fhitx" },
  { symbol: "BILLY", name: "Billy", mint: "3B5wuUrMEi5yATD7on46hKfej3pfmd7t1RKgrsN3pump" },
  { symbol: "BUTTHOLE", name: "Butthole", mint: "FxMLnWRBsdQtHhwXPjDNKXDtC73c3Rv35bB4cVDpump" },
  { symbol: "DOGINME", name: "doginme", mint: "GJtJuWD9qYcCkrwMBmtY1tpapV1sKfB2zUv9Q4aqpump" },
  { symbol: "HOSICO", name: "Hosico Cat", mint: "Au6EdrSDubCUc34awy9c6iKtNwVCkFczBMosIN45pump" },
  { symbol: "LLM", name: "Large Language Model", mint: "G2YReBNBfh1kE6JVr3MyGTAJn4KPsHCBz9G91WTUpump" },
  { symbol: "TANK", name: "Tank", mint: "FmKAfMMnu65jMBFoSrejCbNgRCiCpMh7hb8bAMv7pump" },
  { symbol: "KHAI", name: "Khai", mint: "2cJgFSqZxyKRMCJWtUe6YYpS2M3VaFRvS2QDRkBEpump" },
  { symbol: "LOCKIN", name: "Lock In", mint: "8Ki8DpuWNxu9VsS3kQbarsCWMcFGWkzzA8pUPto9zBio" },
  { symbol: "ZEREBRO", name: "Zerebro", mint: "8x5VqbHA8D7NkD52uNuS5nnt3PwA8pLD34ymskeSo2Wn" },
  { symbol: "NPC", name: "Non-Playable Coin", mint: "Hrt9jHBQTGFnDMKiTemaMGFRmGCi7VZFwsP5Hpumpfun" },
  { symbol: "DADDY", name: "DADDY TATE", mint: "4Cnk9EPnW5ixfLZatCPJjDB1PUtcRpVEgTEi3ti2pump" },
  { symbol: "GROYPER", name: "Groyper", mint: "BDZ8bpKBe9Fxs3YD8RNhZE2oecRRxAcSpBoGprdJpump" },
  { symbol: "LUIGI", name: "Luigi", mint: "GBkKboGR6AFqjmMSEWnNamJXDKfbDeSHnPGZ5MdYpump" },
  { symbol: "SC", name: "Smoking Chicken Fish", mint: "CeMnM3HMfUPPECcEMrG8w5HMuYE4emPbCuMfHZnpump" },
  { symbol: "AWW", name: "Aww", mint: "Aww2F44Ak8BXFuZHi94K1m3rNiUfMZ1i26F3Enpump" },
  { symbol: "PUMP", name: "Pump", mint: "AxRoXRxQmigsrJBaBjNtuN2sPgHagSqZnptai2vQpump" },
  { symbol: "BLINK", name: "Blink", mint: "6jnhbFSaRP56WGFMEByFx3BgqrNBvJT4sqUjiCMpump" },
  { symbol: "TACO", name: "Taco", mint: "E3wRGJoN5q1oGz9VwKQ3CP4YDy3Bp7hpbPCfn4Hmpump" },
  { symbol: "PITY", name: "Pity", mint: "4DMVnTcZPBNmVTfj7K9EhWMkaZoD2kRRUCdHJNApump" },
  { symbol: "MAXXING", name: "MAXXING", mint: "7P9b1V6WiMZGJBxUqm1s2vHJJLkR2N8ACCESS6MtgY" },
];

const MINT_SET = new Set(REGISTRY.map((t) => t.mint));

/* ─── Fetch token + SOL price from DexScreener ─── */
async function fetchPrices(
  mint: string,
): Promise<{ tokenPriceUsd: number; solPriceUsd: number }> {
  const [tokenRes, solRes] = await Promise.all([
    fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`),
    fetch(`https://api.dexscreener.com/tokens/v1/solana/${SOL_MINT}`),
  ]);

  if (!tokenRes.ok || !solRes.ok) {
    throw new Error("Failed to fetch prices from DexScreener");
  }

  const tokenData = await tokenRes.json();
  const solData = await solRes.json();

  const tokenPairs = Array.isArray(tokenData)
    ? tokenData
    : tokenData.pairs || [];
  const solPairs = Array.isArray(solData) ? solData : solData.pairs || [];

  if (tokenPairs.length === 0) {
    throw new Error("No trading pairs found for this token");
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const bestToken = tokenPairs.reduce((best: any, pair: any) =>
    (pair.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? pair : best,
  );
  const bestSol = solPairs.reduce((best: any, pair: any) =>
    (pair.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? pair : best,
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const tokenPriceUsd = parseFloat(bestToken.priceUsd);
  const solPriceUsd = parseFloat(bestSol.priceUsd);

  if (isNaN(tokenPriceUsd) || isNaN(solPriceUsd)) {
    throw new Error("Invalid price data from DexScreener");
  }

  return { tokenPriceUsd, solPriceUsd };
}

/* ─── Build loan calculation for a single tier ─── */
function calcTier(
  tierName: string,
  tier: { ltv: number; days: number },
  amount: number,
  tokenPriceUsd: number,
  solPriceUsd: number,
) {
  const collateralValueUsd = amount * tokenPriceUsd;
  const collateralValueSol = collateralValueUsd / solPriceUsd;
  const grossSol = (collateralValueUsd * tier.ltv) / solPriceUsd;
  const fee = grossSol * FEE_RATE;
  const netSol = grossSol - fee;
  const repayAmount = grossSol;
  const liquidationPrice = (1.1 * grossSol * solPriceUsd) / amount;

  return {
    tier: tierName,
    ltv: tier.ltv * 100,
    durationDays: tier.days,
    collateral: {
      amount,
      valueUsd: Math.round(collateralValueUsd * 100) / 100,
      valueSol: Math.round(collateralValueSol * 1e6) / 1e6,
    },
    loan: {
      grossSol: Math.round(grossSol * 1e6) / 1e6,
      fee: Math.round(fee * 1e6) / 1e6,
      netSol: Math.round(netSol * 1e6) / 1e6,
      repayAmount: Math.round(repayAmount * 1e6) / 1e6,
      liquidationPrice: Math.round(liquidationPrice * 1e8) / 1e8,
    },
  };
}

/* ─── Headers helper ─── */
function headers(cache = true) {
  return {
    "Cache-Control": cache
      ? "public, s-maxage=60, stale-while-revalidate=30"
      : "no-cache",
    "X-Powered-By": "Magpie Protocol",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mint = searchParams.get("mint");
  const amountStr = searchParams.get("amount");
  const tierParam = searchParams.get("tier")?.toLowerCase() ?? null;

  /* ─── Validation ─── */
  if (!mint) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing required parameter: mint",
        usage:
          "GET /api/v1/calculate?mint=<token_mint>&amount=<number>&tier=express|quick|standard",
        timestamp: new Date().toISOString(),
      },
      { status: 400, headers: headers(false) },
    );
  }

  if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing or invalid required parameter: amount (must be > 0)",
        usage:
          "GET /api/v1/calculate?mint=<token_mint>&amount=<number>&tier=express|quick|standard",
        timestamp: new Date().toISOString(),
      },
      { status: 400, headers: headers(false) },
    );
  }

  if (!MINT_SET.has(mint)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Token not supported. Use GET /api/v1/tokens to see all supported tokens.",
        mint,
        timestamp: new Date().toISOString(),
      },
      { status: 404, headers: headers(false) },
    );
  }

  if (tierParam && !TIERS[tierParam]) {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid tier: "${tierParam}". Valid tiers: express, quick, standard`,
        timestamp: new Date().toISOString(),
      },
      { status: 400, headers: headers(false) },
    );
  }

  const amount = Number(amountStr);
  const token = REGISTRY.find((t) => t.mint === mint)!;

  try {
    const { tokenPriceUsd, solPriceUsd } = await fetchPrices(mint);
    const priceSol = tokenPriceUsd / solPriceUsd;

    const tokenInfo = {
      symbol: token.symbol,
      name: token.name,
      mint: token.mint,
      priceUsd: tokenPriceUsd,
      priceSol: Math.round(priceSol * 1e8) / 1e8,
    };

    /* Single tier requested */
    if (tierParam) {
      const tier = TIERS[tierParam];
      const calc = calcTier(tierParam, tier, amount, tokenPriceUsd, solPriceUsd);
      return NextResponse.json(
        {
          ok: true,
          data: {
            token: tokenInfo,
            collateral: calc.collateral,
            loan: {
              tier: calc.tier,
              ltv: calc.ltv,
              durationDays: calc.durationDays,
              grossSol: calc.loan.grossSol,
              fee: calc.loan.fee,
              netSol: calc.loan.netSol,
              repayAmount: calc.loan.repayAmount,
              liquidationPrice: calc.loan.liquidationPrice,
            },
            timestamp: new Date().toISOString(),
          },
        },
        { headers: headers() },
      );
    }

    /* All tiers */
    const tiers = Object.entries(TIERS).map(([name, tier]) =>
      calcTier(name, tier, amount, tokenPriceUsd, solPriceUsd),
    );

    return NextResponse.json(
      {
        ok: true,
        data: {
          token: tokenInfo,
          collateral: tiers[0].collateral,
          tiers: tiers.map((t) => ({
            tier: t.tier,
            ltv: t.ltv,
            durationDays: t.durationDays,
            grossSol: t.loan.grossSol,
            fee: t.loan.fee,
            netSol: t.loan.netSol,
            repayAmount: t.loan.repayAmount,
            liquidationPrice: t.loan.liquidationPrice,
          })),
          timestamp: new Date().toISOString(),
        },
      },
      { headers: headers() },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to fetch live prices",
        message: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 502, headers: headers(false) },
    );
  }
}
