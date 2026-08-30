import { Connection, PublicKey } from "@solana/web3.js";
import { poolPda, priceFeedPda } from "./pdas";
import { LENDER_PUBKEY, PROGRAM_ID_V3, PROGRAM_ID_V4, PROGRAM_ID_V4_1 } from "./constants";

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
      (!!PROGRAM_ID_V4 && programId.equals(PROGRAM_ID_V4)) ||
      (!!PROGRAM_ID_V4_1 && programId.equals(PROGRAM_ID_V4_1));

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

export interface AttestedRef {
  /** Reference price the program checks against, in lamports per WHOLE token. */
  refLamportsPerWholeToken: number;
  source: string;
}

// ── On-chain attested reference price (the CEILING the program enforces) ──
//
// Reads the exact price the lending program will compare a borrow's
// submitted collateral_value against. The borrow builder caps the
// submitted value to this (minus a small drift margin) so the program's
// CollateralValueExceedsAttestation check (V1=6014, V3/V4=6018) can NEVER
// fire from the site — even when the bot's safe-value endpoint was
// unreachable and the flow fell back to its own price source.
//
//   V1/V2 — the single PriceAttestation.price_lamports.
//   V3/V4 — min(spot, median TWAP) over in-window ring-buffer samples,
//           mirroring the bot's /v4/twap "min_of_spot_or_twap".
//
// Returns null if the feed can't be read or has no usable samples — the
// caller then keeps its own value (the on-chain program stays the final
// guard). See feedback_borrow_errors_eliminate_every_class_client_side.
export async function getOnChainAttestedRef(
  connection: Connection,
  mint: PublicKey,
  programId: PublicKey,
): Promise<AttestedRef | null> {
  try {
    const [pool] = poolPda(LENDER_PUBKEY, programId);
    const [feed] = priceFeedPda(mint, pool, programId);
    // Retry once on a transient RPC miss (null OR throw) so a single blip
    // doesn't leave the borrow value uncapped — this read IS the structural
    // CollateralValueExceedsAttestation guard.
    let info = null;
    for (let i = 0; i < 2; i++) {
      try {
        info = await connection.getAccountInfo(feed, "confirmed");
        if (info) break;
      } catch {
        /* transient — retry */
      }
    }
    if (!info || !info.data || info.data.length < 120) return null;
    const d = info.data;
    const isRingBuffer =
      programId.equals(PROGRAM_ID_V3) ||
      (!!PROGRAM_ID_V4 && programId.equals(PROGRAM_ID_V4)) ||
      (!!PROGRAM_ID_V4_1 && programId.equals(PROGRAM_ID_V4_1));

    if (!isRingBuffer) {
      // PriceAttestation: disc(8)+mint(32)+pool(32)+authority(32)
      //   +price_lamports(u64)@104
      const price = Number(d.readBigUInt64LE(104));
      return price > 0
        ? { refLamportsPerWholeToken: price, source: "v1_single" }
        : null;
    }

    const now = Math.floor(Date.now() / 1000);
    let off = 112;
    const inWindow: number[] = [];
    let newest = { t: 0, p: 0 };
    for (let k = 0; k < 32; k++) {
      if (d.length < off + 16) break;
      const p = Number(d.readBigUInt64LE(off));
      const t = Number(d.readBigInt64LE(off + 8));
      off += 16;
      if (t > 0 && now - t <= TWAP_WINDOW_SECONDS) {
        inWindow.push(p);
        if (t > newest.t) newest = { t, p };
      }
    }
    if (inWindow.length === 0) return null;
    const sorted = inWindow.slice().sort((a, b) => a - b);
    const twap = sorted[Math.floor(sorted.length / 2)];
    const spot = newest.p || twap;
    const ref = Math.min(spot, twap);
    return ref > 0
      ? { refLamportsPerWholeToken: ref, source: `v4_min(spot=${spot},twap=${twap})` }
      : null;
  } catch {
    return null;
  }
}
