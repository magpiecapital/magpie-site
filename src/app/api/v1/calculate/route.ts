import { NextRequest, NextResponse } from "next/server";
import { TOKEN_REGISTRY } from "@/lib/token-registry";

/* ─── Constants ─── */
const SOL_MINT = "So11111111111111111111111111111111111111112";
const TIERS: Record<string, { ltv: number; days: number; fee: number }> = {
  express: { ltv: 0.3, days: 2, fee: 0.03 },
  quick: { ltv: 0.25, days: 3, fee: 0.02 },
  standard: { ltv: 0.2, days: 7, fee: 0.015 },
};

const REGISTRY = TOKEN_REGISTRY;

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
  tier: { ltv: number; days: number; fee: number },
  amount: number,
  tokenPriceUsd: number,
  solPriceUsd: number,
) {
  const collateralValueUsd = amount * tokenPriceUsd;
  const collateralValueSol = collateralValueUsd / solPriceUsd;
  const grossSol = (collateralValueUsd * tier.ltv) / solPriceUsd;
  const fee = grossSol * tier.fee;
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
