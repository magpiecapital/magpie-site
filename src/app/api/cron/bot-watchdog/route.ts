/**
 * External bot uptime watchdog.
 *
 * Runs on a Vercel cron (every minute) and pings the bot's
 * /api/v1/health endpoint. If the bot doesn't respond within 8s, we
 * DM the operator DIRECTLY via the Telegram API — NOT through our
 * own bot, because our bot is what's down.
 *
 * The bot token is shared so this watchdog can send DMs that appear
 * to come from the same bot the operator already trusts. When the
 * bot itself is down, Telegram's infra is still up and accepts the
 * sendMessage call.
 *
 * Why an external service (Vercel cron) instead of a bot self-check:
 *   A self-monitoring bot can't tell you when it's down because IT'S
 *   what's down. External monitoring is the only way to know the bot
 *   is reachable from the public internet — which is what site visitors
 *   and Pip actually use.
 *
 * Env vars required (set on the magpie-site Vercel project):
 *   MAGPIE_BOT_TOKEN          — same token the bot uses; lets the
 *                               watchdog DM through Telegram
 *   OPERATOR_TG_CHAT_ID       — numeric Telegram chat ID for the
 *                               operator's DM (NOT @username)
 *   MAGPIE_BOT_HEALTH_URL     — optional override; defaults to the
 *                               Railway prod URL
 *   CRON_SECRET               — Vercel best-practice: require this in
 *                               query/header so only authorized callers
 *                               can trigger the cron path. Vercel auto-
 *                               adds Authorization: Bearer <CRON_SECRET>
 *                               on cron-triggered runs.
 *
 * Failure mode:
 *   If MAGPIE_BOT_TOKEN or OPERATOR_TG_CHAT_ID isn't set, the watchdog
 *   degrades silently to a no-op (returns 200 with a status message)
 *   instead of throwing. Better to have a working cron that doesn't
 *   alert than a broken cron that breaks the rest of the cron schedule.
 */

import { NextResponse } from "next/server";
import { runTgOutageProtection } from "@/lib/fallback/tg-outage-protection";

const DEFAULT_HEALTH_URL =
  "https://magpie-bot-production.up.railway.app/api/v1/health";
const HEALTH_TIMEOUT_MS = 8_000;

// Telegram parse_mode for the alert. Using plain text (not Markdown)
// so we never have to escape special chars in a future error message.
const ALERT_PARSE_MODE = undefined;

function isAuthorizedCron(req: Request): boolean {
  // Vercel adds Authorization: Bearer <CRON_SECRET> on cron runs.
  // Allow that path. Also allow no-auth in dev (when CRON_SECRET is
  // unset) so local testing works.
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

async function pingBot(): Promise<{ ok: boolean; status: number; detail: string }> {
  const url = process.env.MAGPIE_BOT_HEALTH_URL || DEFAULT_HEALTH_URL;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    // 200 = healthy, 503 = degraded BUT REACHABLE. Both are "process
    // is alive and serving HTTP" — only 503 means a sub-system is
    // unhealthy. For the watchdog, the only thing that matters is
    // "is the bot reachable at all" — that's what determines if site
    // + Pip work. So 503 is acceptable.
    return {
      ok: res.status === 200 || res.status === 503,
      status: res.status,
      detail: res.status === 503 ? "degraded (some sub-system unhealthy but reachable)" : "ok",
    };
  } catch (err) {
    clearTimeout(timer);
    const e = err as { name?: string; message?: string };
    return {
      ok: false,
      status: 0,
      detail: e.name === "AbortError"
        ? `timeout after ${HEALTH_TIMEOUT_MS}ms`
        : (e.message || "fetch failed").slice(0, 200),
    };
  }
}

async function sendOperatorAlert(text: string): Promise<{ sent: boolean; error?: string }> {
  const token = process.env.MAGPIE_BOT_TOKEN;
  const chatId = process.env.OPERATOR_TG_CHAT_ID;
  if (!token || !chatId) {
    return { sent: false, error: "watchdog_not_configured (set MAGPIE_BOT_TOKEN + OPERATOR_TG_CHAT_ID)" };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: ALERT_PARSE_MODE,
          disable_notification: false,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, error: `tg_api ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message?.slice(0, 200) || "tg_send_failed" };
  }
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ping = await pingBot();

  // ── TG user outage-protection sweep ──
  // Runs on EVERY cron tick (not just on bot-down). When the bot has
  // been down for OUTAGE_THRESHOLD consecutive ticks, this DMs every
  // recently-active TG user a one-time status notice directing them
  // to magpie.capital. When the bot recovers, sends an all-clear to
  // everyone who got the down alert.
  //
  // Best-effort: if the DB or TG sends fail, we log + continue. The
  // operator-DM path below is the load-bearing alert; this is a
  // user-experience enhancement on top.
  const tgOutageResult = await runTgOutageProtection({
    botIsReachable: ping.ok,
    botStatus: ping.status,
    detail: ping.detail,
  }).catch((err) => ({
    error: (err as Error).message?.slice(0, 200) || "tg_outage_protection_threw",
    triggered: false,
  }));

  if (ping.ok) {
    // Bot reachable — nothing to alert about. Return the status for
    // debugging via the Vercel logs.
    return NextResponse.json({
      ok: true,
      bot_status: ping.status,
      detail: ping.detail,
      tg_outage_protection: tgOutageResult,
      checked_at: new Date().toISOString(),
    });
  }

  // Bot UNREACHABLE — page the operator.
  const alert =
    `BOT DOWN — Magpie API unreachable.\n\n` +
    `time: ${new Date().toISOString()}\n` +
    `endpoint: ${process.env.MAGPIE_BOT_HEALTH_URL || DEFAULT_HEALTH_URL}\n` +
    `detail: ${ping.detail}\n` +
    `http: ${ping.status || "no-response"}\n\n` +
    `Site dashboard, /borrow, /repay, and Pip will all be broken until this recovers.\n` +
    `Check Railway service status + logs.`;

  const alertResult = await sendOperatorAlert(alert);

  return NextResponse.json(
    {
      ok: false,
      bot_status: ping.status,
      detail: ping.detail,
      alert_sent: alertResult.sent,
      alert_error: alertResult.error,
      tg_outage_protection: tgOutageResult,
      checked_at: new Date().toISOString(),
    },
    { status: 503 },
  );
}
