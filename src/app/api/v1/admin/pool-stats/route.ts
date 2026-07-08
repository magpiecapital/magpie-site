/**
 * GET /api/v1/admin/pool-stats?wallet=<creator>&ts=<unixMs>&sig=<base58>
 *
 * Proxies to the bot's admin endpoint which gates on wallet === LENDER_PUBKEY.
 *
 * SECURITY: the `wallet` query param alone is NOT a credential — the lender /
 * creator address is public (on-chain + published in this repo). The caller
 * MUST prove ownership of that key by signing a fresh, endpoint-scoped
 * challenge with it (ed25519). We verify the signature and the `wallet ===
 * ADMIN_WALLET` gate here before forwarding; the bot performs its own gate as
 * defence in depth.
 */
import { NextResponse } from "next/server";
import { ed25519 } from "@noble/curves/ed25519.js";
import bs58 from "bs58";

const BOT_API_URL = process.env.BOT_API_URL ?? "";

// Public creator/lender wallet. Public key equality is NOT auth on its own —
// it is only accepted alongside a valid signature proving key ownership below.
const ADMIN_WALLET =
  process.env.ADMIN_WALLET ?? "4JSSSaG3xRomQsrxmdQEsahfyFjBVjvuoBKJUUZgzPAx";

// Endpoint-scoped challenge. The admin wallet signs the UTF-8 bytes of this
// message; `ts` binds it to a short freshness window to prevent replay.
const CHALLENGE_MAX_AGE_MS = 120_000;
function buildChallenge(wallet: string, ts: string): Uint8Array {
  return new TextEncoder().encode(`magpie-admin:pool-stats:${wallet}:${ts}`);
}

function verifyAdmin(
  wallet: string | null,
  ts: string | null,
  sig: string | null,
): { ok: true } | { ok: false; status: number; error: string } {
  if (!wallet) return { ok: false, status: 400, error: "Missing ?wallet" };
  if (!ts || !sig) {
    return { ok: false, status: 401, error: "Missing signed challenge (ts, sig)" };
  }
  if (wallet !== ADMIN_WALLET) {
    return { ok: false, status: 403, error: "Not authorized" };
  }
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > CHALLENGE_MAX_AGE_MS) {
    return { ok: false, status: 401, error: "Challenge expired or invalid" };
  }
  try {
    const okSig = ed25519.verify(
      bs58.decode(sig),
      buildChallenge(wallet, ts),
      bs58.decode(wallet),
    );
    if (!okSig) return { ok: false, status: 401, error: "Bad signature" };
  } catch {
    return { ok: false, status: 401, error: "Bad signature" };
  }
  return { ok: true };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  const ts = searchParams.get("ts");
  const sig = searchParams.get("sig");

  const auth = verifyAdmin(wallet, ts, sig);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  if (!BOT_API_URL) {
    return NextResponse.json({ ok: false, error: "BOT_API_URL not configured" }, { status: 500 });
  }
  try {
    const res = await fetch(`${BOT_API_URL}/api/v1/admin/pool-stats?wallet=${encodeURIComponent(wallet!)}`, {
      signal: AbortSignal.timeout(12_000),
    });
    const body = await res.json();
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
