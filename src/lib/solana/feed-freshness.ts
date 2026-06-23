import { Connection, PublicKey } from "@solana/web3.js";
import { poolPda, priceFeedPda } from "./pdas";
import { LENDER_PUBKEY, PROGRAM_ID_V3, PROGRAM_ID_V4 } from "./constants";

// ── On-chain price-feed freshness check (authoritative, client-side) ──
//
// The borrow flow tops up the price feed via the bot's /price/refresh
// before signing. That call is a CONVENIENCE — the attestor keeps every
// enabled mint's feed warm on its own cadence. The AUTHORITATIVE gate is
// the on-chain feed the lending program actually reads at execution.
//
// This helper reads that feed directly (no bot dependency — works even
// during a bot deploy) and reports whether it is fresh enough that the
// program will accept a borrow right now. Used to FAIL OPEN when the
// off-chain refresh fails for infra reasons (cooldown / blip / deploy)
// but the lower on-chain layer is provably safe — so a healthy feed
// never surfaces a false "Markets warming up" hold.
// See feedback_no_markets_warming_up_error_ever.md +
// feedback_defense_in_depth_failopen_when_lower_layer_proven.md.

// Program stale walls, with margin for the sign+submit latency window.
// V1/V2/V3 single-attestation programs reject a feed older than ~120s;
// we require ≤90s so the feed is still valid by the time the wallet
// signs and the tx lands. V4's TWAP gate needs ≥8 samples within 300s.
const STALE_WALL_SECONDS = 90;
const TWAP_WINDOW_SECONDS = 300;
const TWAP_MIN_SAMPLES = 8;

export interface FeedFreshness {
  borrowable: boolean;
  reason: string;
}

export async function isOnChainFeedBorrowable(
  connection: Connection,
  mint: PublicKey,
  programId: PublicKey,
): Promise<FeedFreshness> {
  try {
    const [pool] = poolPda(LENDER_PUBKEY, programId);
    const [feed] = priceFeedPda(mint, pool, programId);
    const info = await connection.getAccountInfo(feed, "confirmed");
    if (!info || !info.data || info.data.length < 120) {
      return { borrowable: false, reason: "feed_missing_or_short" };
    }
    const now = Math.floor(Date.now() / 1000);
    const d = info.data;
    const isRingBuffer =
      programId.equals(PROGRAM_ID_V3) ||
      (!!PROGRAM_ID_V4 && programId.equals(PROGRAM_ID_V4));

    if (!isRingBuffer) {
      // V1/V2 PriceAttestation:
      //   disc(8)+mint(32)+pool(32)+authority(32)+price_lamports(8)
      //   +timestamp(i64)@112 +confidence_bps(u16)+bump
      const ts = Number(d.readBigInt64LE(112));
      const age = now - ts;
      return age >= 0 && age <= STALE_WALL_SECONDS
        ? { borrowable: true, reason: `fresh_${age}s` }
        : { borrowable: false, reason: `stale_${age}s` };
    }

    // V3/V4 PriceHistory ring buffer:
    //   disc(8)+mint(32)+pool(32)+authority(32)+head_index(1)+count(1)
    //   +_padding(6) → samples[32]{price_lamports(8),timestamp(i64)}@112
    let off = 112;
    let inWindow = 0;
    let newestAge = Number.POSITIVE_INFINITY;
    for (let k = 0; k < 32; k++) {
      if (d.length < off + 16) break;
      const ts = Number(d.readBigInt64LE(off + 8));
      off += 16;
      if (ts > 0) {
        const age = now - ts;
        if (age >= 0 && age <= TWAP_WINDOW_SECONDS) inWindow++;
        if (age >= 0 && age < newestAge) newestAge = age;
      }
    }
    if (inWindow >= TWAP_MIN_SAMPLES && newestAge <= STALE_WALL_SECONDS) {
      return { borrowable: true, reason: `twap_${inWindow}in300s_newest_${newestAge}s` };
    }
    return {
      borrowable: false,
      reason: `twap_${inWindow}/${TWAP_MIN_SAMPLES}_newest_${Number.isFinite(newestAge) ? newestAge + "s" : "none"}`,
    };
  } catch (e) {
    // Couldn't read the chain — do NOT claim borrowable; the caller keeps
    // its conservative hold-back in that case.
    return { borrowable: false, reason: `read_error:${(e as Error)?.message?.slice(0, 40)}` };
  }
}
