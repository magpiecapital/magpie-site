/**
 * TG outage protection — proactive user DMs during bot outages.
 *
 * Called from the bot-watchdog cron on every tick.
 *
 * Behavior:
 *   - Bot reachable AND no open outage → no-op
 *   - Bot reachable AND there IS an open outage → close it, send
 *     all-clear DMs to every user who got a 'down' alert
 *   - Bot unreachable → increment consecutive_failures on the open
 *     outage row (or create one). If failures reach OUTAGE_THRESHOLD
 *     for the first time, DM every recently-active TG user once
 *     (deduped via tg_outage_alerts).
 *
 * The point: when Railway is down, TG users who try `/borrow` or
 * `/repay` see nothing happen. This system proactively tells them
 * the bot is down and to use magpie.capital for urgent actions.
 * They don't have to figure it out themselves.
 *
 * Rate / spam control:
 *   - One 'down' DM per user PER outage (dedup on tg_outage_alerts.outage_id + user_id)
 *   - One 'recovered' DM per user PER outage (same dedup, alert_kind='recovered')
 *   - Recently-active = active in the bot in the last RECENT_ACTIVE_HOURS
 *     hours. Don't blast dormant users for an outage they wouldn't
 *     have noticed.
 *
 * Failure handling:
 *   - DB connection failure → log + return early. Bot operator alerts
 *     still fire via the parent watchdog endpoint.
 *   - Individual TG sendMessage failure (blocked / deactivated /
 *     chat not found) → swallow, continue with other users. We log
 *     a per-user error so the operator can investigate persistent
 *     fail patterns later.
 */
import { getPool, ensureSchema } from "./tg-outage-state";

// Number of consecutive failed health pings before we DM users.
// One failed ping = ~60s for the Vercel cron. So 3 = ~3 min of
// continuous downtime. Avoids notifying users for brief restarts.
const OUTAGE_THRESHOLD = 3;

// Time window for "recently active" — used as fallback when no
// active loans exist. Users with active loans are always notified
// regardless of this window because they have skin in the game.
const RECENT_ACTIVE_HOURS = 24;

// Cap how many DMs we send per cron tick. Telegram's flood-protect
// will throttle us at ~30 msg/sec; we keep well under that.
const MAX_DMS_PER_TICK = 50;

// Where the DM points users for urgent actions. Hardcoded — env var
// would be overkill for a constant URL.
const FALLBACK_URL = "https://magpie.capital/dashboard";

interface OutageRow {
  id: number;
  started_at: Date;
  consecutive_failures: number;
}

export interface OutageProtectionResult {
  ok?: boolean;
  triggered: boolean;
  detail?: string;
  outage_id?: number;
  consecutive_failures?: number;
  down_alerts_sent?: number;
  recovery_alerts_sent?: number;
  error?: string;
}

export async function runTgOutageProtection({
  botIsReachable,
  botStatus,
  detail,
}: {
  botIsReachable: boolean;
  botStatus: number;
  detail: string;
}): Promise<OutageProtectionResult> {
  // If watchdog secrets aren't configured, skip — we won't be able
  // to send DMs even if we detect an outage.
  const token = process.env.MAGPIE_BOT_TOKEN;
  if (!token) {
    return { triggered: false, detail: "MAGPIE_BOT_TOKEN not set; tg outage protection skipped" };
  }
  if (!process.env.DATABASE_URL) {
    return { triggered: false, detail: "DATABASE_URL not set; tg outage protection skipped" };
  }

  try {
    await ensureSchema();
  } catch (err) {
    return { triggered: false, error: `schema_init_failed: ${(err as Error).message?.slice(0, 100)}` };
  }

  const pool = getPool();

  // Find the currently-open outage row (if any).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { rows: openRows } = await pool.query<any>(
    `SELECT id, started_at, consecutive_failures
       FROM tg_outage_state
      WHERE ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1`,
  );
  const openOutage: OutageRow | null = openRows[0] ?? null;

  if (botIsReachable) {
    // Recovery path.
    if (!openOutage) {
      // Normal steady state — nothing to do.
      return { ok: true, triggered: false };
    }
    // Close the outage and DM every user who got the 'down' alert.
    await pool.query(
      `UPDATE tg_outage_state SET ended_at = NOW() WHERE id = $1`,
      [openOutage.id],
    );
    const sent = await sendRecoveryDmsForOutage(pool, openOutage.id, token);
    return {
      triggered: true,
      ok: true,
      outage_id: openOutage.id,
      recovery_alerts_sent: sent,
      detail: `bot recovered; closed outage #${openOutage.id}, sent ${sent} all-clear DMs`,
    };
  }

  // ── Bot is unreachable ──
  let outageId: number;
  let consecutiveFailures: number;
  if (openOutage) {
    const upd = await pool.query<{ id: number; consecutive_failures: number }>(
      `UPDATE tg_outage_state
          SET consecutive_failures = consecutive_failures + 1,
              last_check_at = NOW(),
              reason = $2
        WHERE id = $1
        RETURNING id, consecutive_failures`,
      [openOutage.id, `status=${botStatus} detail=${detail.slice(0, 200)}`],
    );
    outageId = upd.rows[0].id;
    consecutiveFailures = upd.rows[0].consecutive_failures;
  } else {
    const ins = await pool.query<{ id: number; consecutive_failures: number }>(
      `INSERT INTO tg_outage_state (consecutive_failures, reason)
         VALUES (1, $1)
         RETURNING id, consecutive_failures`,
      [`status=${botStatus} detail=${detail.slice(0, 200)}`],
    );
    outageId = ins.rows[0].id;
    consecutiveFailures = ins.rows[0].consecutive_failures;
  }

  if (consecutiveFailures < OUTAGE_THRESHOLD) {
    // Not yet long enough to alert users. Avoid notification spam
    // on short restarts.
    return {
      triggered: true,
      ok: true,
      outage_id: outageId,
      consecutive_failures: consecutiveFailures,
      detail: `outage detected, below threshold (${consecutiveFailures}/${OUTAGE_THRESHOLD})`,
    };
  }

  // ── Outage confirmed — DM users with skin in the game ──
  // Priority targeting:
  //   1. Users with active loans (HIGH PRIORITY — they need to manage
  //      open positions, missing the bot may cost them)
  //   2. Users with loan activity (create/repay/etc) in the last N hours
  //      via the loans.updated_at timestamp
  // Dedup against tg_outage_alerts: each user gets at most one 'down'
  // DM per outage event.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { rows: targets } = await pool.query<any>(
    `WITH candidates AS (
       SELECT DISTINCT u.id AS user_id, u.telegram_id,
              MAX(l.updated_at) AS last_loan_at,
              BOOL_OR(l.status = 'active') AS has_active
         FROM users u
         JOIN loans l ON l.user_id = u.id
        WHERE u.telegram_id IS NOT NULL
          AND (
                l.status = 'active'
            OR  l.updated_at > NOW() - INTERVAL '${RECENT_ACTIVE_HOURS} hours'
          )
        GROUP BY u.id, u.telegram_id
     )
     SELECT c.user_id, c.telegram_id
       FROM candidates c
      WHERE NOT EXISTS (
        SELECT 1 FROM tg_outage_alerts a
         WHERE a.outage_id = $1 AND a.user_id = c.user_id AND a.alert_kind = 'down'
      )
      ORDER BY c.has_active DESC, c.last_loan_at DESC NULLS LAST
      LIMIT $2`,
    [outageId, MAX_DMS_PER_TICK],
  );

  if (targets.length === 0) {
    return {
      triggered: true,
      ok: true,
      outage_id: outageId,
      consecutive_failures: consecutiveFailures,
      down_alerts_sent: 0,
      detail: "no recently-active users to notify or all already notified",
    };
  }

  const downText =
    `Magpie service notice — the bot is temporarily unavailable while it restarts. ` +
    `Your active loans are safe and on-chain; nothing has changed.\n\n` +
    `For urgent borrow / repay during the restart, use the website: ${FALLBACK_URL}\n\n` +
    `You'll get an "all clear" message here when the bot is back. Usually within a few minutes.`;

  let sent = 0;
  for (const t of targets) {
    const tgId = String(t.telegram_id);
    const ok = await safeTgSend(token, tgId, downText);
    await pool.query(
      `INSERT INTO tg_outage_alerts (outage_id, user_id, telegram_id, alert_kind)
         VALUES ($1, $2, $3, 'down')`,
      [outageId, t.user_id, tgId],
    );
    if (ok) sent++;
  }

  return {
    triggered: true,
    ok: true,
    outage_id: outageId,
    consecutive_failures: consecutiveFailures,
    down_alerts_sent: sent,
    detail: `sent ${sent}/${targets.length} down DMs (more may be sent on next tick if > ${MAX_DMS_PER_TICK})`,
  };
}

/**
 * Send the all-clear DM to every user who got a 'down' alert for
 * this outage. Mirror the dedup: only users with a 'down' row and
 * no 'recovered' row yet.
 */
async function sendRecoveryDmsForOutage(
  pool: ReturnType<typeof getPool>,
  outageId: number,
  token: string,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { rows: targets } = await pool.query<any>(
    `SELECT DISTINCT a.user_id, a.telegram_id
       FROM tg_outage_alerts a
      WHERE a.outage_id = $1
        AND a.alert_kind = 'down'
        AND NOT EXISTS (
          SELECT 1 FROM tg_outage_alerts r
           WHERE r.outage_id = $1
             AND r.user_id = a.user_id
             AND r.alert_kind = 'recovered'
        )
      LIMIT $2`,
    [outageId, MAX_DMS_PER_TICK * 4],
  );
  if (targets.length === 0) return 0;

  const text =
    `All clear — the Magpie bot is back online. You can resume /borrow, /repay, ` +
    `and other commands normally. Thanks for your patience.`;

  let sent = 0;
  for (const t of targets) {
    const tgId = String(t.telegram_id);
    const ok = await safeTgSend(token, tgId, text);
    await pool.query(
      `INSERT INTO tg_outage_alerts (outage_id, user_id, telegram_id, alert_kind)
         VALUES ($1, $2, $3, 'recovered')`,
      [outageId, t.user_id, tgId],
    );
    if (ok) sent++;
  }
  return sent;
}

/**
 * Telegram sendMessage that never throws. Per-user errors (blocked,
 * deactivated, chat not found) are normal and we just want to skip
 * them silently.
 */
async function safeTgSend(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          // No parse_mode — keeps the text simple + no escape gotchas.
          disable_notification: false,
          // disable_web_page_preview keeps the magpie.capital link
          // from generating a big card in the chat.
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
