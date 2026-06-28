import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed",
);

const ADMIN_TG_ID = process.env.ADMIN_TELEGRAM_ID ?? "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

// SECURITY: DexScreener-controlled token symbol/name fields can contain
// Markdown control characters (e.g. a token named "[click](https://evil)").
// Without escaping, those land as clickable phishing links in the operator's
// TG. Mirror the MarkdownV2 sanitizer from /api/token-request/route.ts and
// switch parse_mode to MarkdownV2 below. Caught by audit 2026-06-17 PM.
const MAX_FIELD = 200;
function escapeMd(s: string): string {
  if (s == null) return "";
  return String(s).replace(/[_*`\[\]()~>#+\-=|{}.!\\]/g, "\\$&").slice(0, MAX_FIELD);
}

// ── Thresholds (match bot's submit.js + token-screener.js) ──

const AUTO_APPROVE = {
  minLiquidityUsd: 75_000,
  minAgeHours: 24,
  minVolume24h: 50_000,
  minMarketCap: 250_000,
};

const MIN_CONSIDER = {
  minLiquidityUsd: 30_000,
  minAgeHours: 12,
  minVolume24h: 10_000,
};

// ── On-chain ──

async function getOnChainInfo(mintStr: string) {
  try {
    const info = await connection.getAccountInfo(new PublicKey(mintStr));
    if (!info || info.data.length < 82) return null;
    return {
      decimals: info.data.readUInt8(44),
      hasMintAuthority: info.data.readUInt32LE(0) === 1,
      hasFreezeAuthority: info.data.readUInt32LE(46) === 1,
    };
  } catch {
    return null;
  }
}

// ── Market data ──

interface MarketInfo {
  symbol: string;
  name: string;
  liquidity: number;
  volume24h: number;
  marketCap: number;
  pairCreatedAt: number | null;
  imageUrl: string | null;
}

async function fetchMarketData(mint: string): Promise<MarketInfo | null> {
  const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`);
  if (!res.ok) return null;
  const pairs = await res.json();
  if (!Array.isArray(pairs) || pairs.length === 0) return null;

  let best: MarketInfo | null = null;
  for (const p of pairs) {
    const liq = p.liquidity?.usd ?? 0;
    if (!best || liq > best.liquidity) {
      best = {
        symbol: p.baseToken?.symbol || "???",
        name: p.baseToken?.name || p.baseToken?.symbol || "Unknown",
        liquidity: liq,
        volume24h: p.volume?.h24 ?? 0,
        marketCap: p.marketCap ?? p.fdv ?? 0,
        pairCreatedAt: p.pairCreatedAt ?? null,
        imageUrl: p.info?.imageUrl ?? null,
      };
    }
  }
  return best;
}

// ── Resolve symbol to mint ──

async function resolveSymbol(input: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(input)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.pairs) return null;

    let best: { mint: string; liq: number } | null = null;
    for (const p of data.pairs) {
      if (p.chainId !== "solana") continue;
      const liq = p.liquidity?.usd ?? 0;
      if (!best || liq > best.liq) {
        best = { mint: p.baseToken?.address, liq };
      }
    }
    return best?.mint ?? null;
  } catch {
    return null;
  }
}

// ── Notify admin via Telegram ──

async function notifyAdmin(text: string, replyMarkup?: unknown) {
  if (!BOT_TOKEN || !ADMIN_TG_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_TG_ID,
        text,
        // SECURITY: MarkdownV2 + escape every interpolated field.
        // DexScreener-supplied symbol/name can carry Markdown control chars
        // and weaponize legacy Markdown parse_mode (audit finding S3).
        parse_mode: "MarkdownV2",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
  } catch { /* non-critical */ }
}

// ── POST handler ──

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let input = (body.mint || "").trim();

    if (!input) {
      return NextResponse.json({ error: "Mint address or symbol is required" }, { status: 400 });
    }

    // Resolve symbol to mint if not an address
    let mint = input;
    const isAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input);
    if (!isAddress) {
      const resolved = await resolveSymbol(input);
      if (!resolved) {
        return NextResponse.json({
          verdict: "not_found",
          message: `Could not find a Solana token matching "${input}". Try the full mint address.`,
        });
      }
      mint = resolved;
    }

    // Check if already supported
    const { rows: existing } = await query(
      "SELECT symbol, enabled FROM supported_mints WHERE mint = $1", [mint],
    );
    if (existing.length > 0 && existing[0].enabled) {
      return NextResponse.json({
        verdict: "already_supported",
        symbol: existing[0].symbol,
        message: `${existing[0].symbol} is already supported as collateral.`,
      });
    }

    // Check if already in review queue
    const { rows: queued } = await query(
      "SELECT symbol, status FROM token_screen_queue WHERE mint = $1", [mint],
    );
    if (queued.length > 0 && queued[0].status === "pending") {
      return NextResponse.json({
        verdict: "in_review",
        symbol: queued[0].symbol,
        message: `${queued[0].symbol} is already under review.`,
      });
    }

    // Run on-chain + market checks in parallel
    const [onChain, market] = await Promise.all([
      getOnChainInfo(mint),
      fetchMarketData(mint),
    ]);

    if (!onChain) {
      return NextResponse.json({
        verdict: "invalid",
        message: "Could not read on-chain data. Make sure this is a valid SPL token mint address.",
      });
    }
    if (!market) {
      return NextResponse.json({
        verdict: "no_trading",
        message: "No trading pairs found on DexScreener. The token needs active trading history.",
      });
    }

    const ageHours = market.pairCreatedAt
      ? Math.floor((Date.now() - market.pairCreatedAt) / 3_600_000) : 0;

    // Safety checks
    const fails: string[] = [];
    if (onChain.hasMintAuthority) fails.push("Mint authority is enabled");
    if (onChain.hasFreezeAuthority) fails.push("Freeze authority is enabled");
    if (market.liquidity < MIN_CONSIDER.minLiquidityUsd)
      fails.push(`Liquidity ($${Math.floor(market.liquidity).toLocaleString()}) below $30K minimum`);
    if (ageHours < MIN_CONSIDER.minAgeHours)
      fails.push(`Token is only ${ageHours}h old (minimum 12h)`);
    if (market.volume24h < MIN_CONSIDER.minVolume24h)
      fails.push(`24h volume ($${Math.floor(market.volume24h).toLocaleString()}) below $10K minimum`);

    const stats = {
      symbol: market.symbol,
      name: market.name,
      mint,
      liquidity: Math.floor(market.liquidity),
      volume24h: Math.floor(market.volume24h),
      marketCap: Math.floor(market.marketCap),
      ageHours,
      hasMintAuthority: onChain.hasMintAuthority,
      hasFreezeAuthority: onChain.hasFreezeAuthority,
    };

    // Rejected
    if (onChain.hasMintAuthority || onChain.hasFreezeAuthority || fails.length > 0) {
      return NextResponse.json({ verdict: "rejected", ...stats, fails });
    }

    // Auto-approve vs review
    const canAutoApprove =
      market.liquidity >= AUTO_APPROVE.minLiquidityUsd &&
      ageHours >= AUTO_APPROVE.minAgeHours &&
      market.volume24h >= AUTO_APPROVE.minVolume24h &&
      market.marketCap >= AUTO_APPROVE.minMarketCap;

    if (canAutoApprove) {
      // SECURITY (2026-06-28 audit): a public, unauthenticated web submission
      // must NEVER write enabled=TRUE to supported_mints. Passing the SIZE
      // gates (liquidity / age / volume / mcap) is NOT a scam audit — those
      // can be wash-traded. The bot's /submit path runs the real gauntlet
      // (sellability/honeypot, holder-concentration, LP-burn, RugCheck) and
      // hard-rejects before enabling; this endpoint cannot, so an auto-enabled
      // honeypot would be INSTANTLY BORROWABLE and the pool could be drained
      // (borrow → pull LP → seized collateral is unsellable; liquidation is
      // time-based and can't recover it). So we QUEUE high-quality submissions
      // for the full audit (token_screen_queue, status='pending') exactly like
      // borderline ones — the bot screener / operator enables ONLY after the
      // gauntlet passes. We deliberately do NOT insert token_screen_seen, so
      // the background screener WILL pick it up and audit it.
      await query(
        `INSERT INTO token_screen_queue
           (mint, symbol, name, decimals, category, image_url, liquidity_usd,
            volume_24h_usd, market_cap_usd, holder_count, has_mint_authority,
            has_freeze_authority, token_age_hours, safety_score, fail_reasons, status)
         VALUES ($1,$2,$3,$4,'memecoin',$5,$6,$7,$8,0,FALSE,FALSE,$9,90,$10,'pending')
         ON CONFLICT (mint) DO UPDATE SET
           liquidity_usd = EXCLUDED.liquidity_usd, volume_24h_usd = EXCLUDED.volume_24h_usd,
           market_cap_usd = EXCLUDED.market_cap_usd, status = 'pending'`,
        [mint, market.symbol.toUpperCase(), market.name, onChain.decimals,
         market.imageUrl, market.liquidity, market.volume24h, market.marketCap,
         ageHours, ["Passed auto-approve size gates — fast-track candidate, pending full scam audit"]],
      );

      await notifyAdmin(
        `*Web submission — fast-track candidate (PENDING scam audit, not yet enabled)*\n\n${escapeMd(market.symbol)} — $${Math.floor(market.liquidity).toLocaleString()} liq, $${Math.floor(market.marketCap).toLocaleString()} mcap\n\`${mint}\`\n\n_Passed size gates. Enable only after the full audit (sellability / holder-concentration / LP-burn / rugcheck)._`,
      );

      return NextResponse.json({ verdict: "pending_review", ...stats });
    }

    // Borderline — queue for review
    await query(
      `INSERT INTO token_screen_queue
         (mint, symbol, name, decimals, category, image_url, liquidity_usd,
          volume_24h_usd, market_cap_usd, holder_count, has_mint_authority,
          has_freeze_authority, token_age_hours, safety_score, fail_reasons, status)
       VALUES ($1,$2,$3,$4,'memecoin',$5,$6,$7,$8,0,FALSE,FALSE,$9,70,$10,'pending')
       ON CONFLICT (mint) DO UPDATE SET
         liquidity_usd = EXCLUDED.liquidity_usd, volume_24h_usd = EXCLUDED.volume_24h_usd,
         market_cap_usd = EXCLUDED.market_cap_usd, status = 'pending'`,
      [mint, market.symbol.toUpperCase(), market.name, onChain.decimals,
       market.imageUrl, market.liquidity, market.volume24h, market.marketCap,
       ageHours, ["Borderline — meets safety minimums but not auto-approve thresholds"]],
    );
    await query("INSERT INTO token_screen_seen (mint) VALUES ($1) ON CONFLICT DO NOTHING", [mint]);

    await notifyAdmin(
      `*Web submission needs review*\n\n*${escapeMd(market.symbol)}* — ${escapeMd(market.name)}\nLiq: $${Math.floor(market.liquidity).toLocaleString()} \\| Vol: $${Math.floor(market.volume24h).toLocaleString()} \\| MCap: $${Math.floor(market.marketCap).toLocaleString()}\nAge: ${ageHours}h\n\`${mint}\``,
      { inline_keyboard: [[
        { text: "Approve", callback_data: `screen:approve:${mint}` },
        { text: "Reject", callback_data: `screen:reject:${mint}` },
      ]] },
    );

    return NextResponse.json({ verdict: "review", ...stats });
  } catch (err) {
    console.error("[submit-token] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
