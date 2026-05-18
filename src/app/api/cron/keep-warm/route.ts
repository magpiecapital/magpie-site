import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

/**
 * Vercel Cron — runs every 10 minutes to keep token data fresh.
 *
 * 1. Pings DB to verify connectivity
 * 2. Revalidates ISR pages (landing, whitepaper, tokens) so they
 *    always have recent data in the CDN cache
 * 3. Returns status for monitoring
 *
 * Protected by CRON_SECRET to prevent unauthorized invocations.
 */

export async function GET(req: Request) {
  // Verify cron secret (Vercel injects this header for cron jobs)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = { timestamp: new Date().toISOString() };

  // 1. Check DB connectivity and get token count
  try {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count FROM supported_mints WHERE enabled = TRUE`,
    );
    results.db = { ok: true, tokenCount: rows[0].count };
  } catch (err) {
    results.db = { ok: false, error: (err as Error).message };
  }

  // 2. Revalidate ISR pages so CDN always has fresh data
  try {
    revalidatePath("/");
    revalidatePath("/whitepaper");
    revalidatePath("/tokens");
    results.revalidated = ["/", "/whitepaper", "/tokens"];
  } catch (err) {
    results.revalidateError = (err as Error).message;
  }

  return NextResponse.json({ ok: true, ...results });
}
