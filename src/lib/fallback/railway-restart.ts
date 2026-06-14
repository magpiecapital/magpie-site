/**
 * Railway auto-restart — "backup generator" for the bot watchdog.
 *
 * When the bot has been unreachable for AUTO_RESTART_THRESHOLD
 * consecutive cron ticks, the watchdog calls this module to redeploy
 * the Railway service via the GraphQL API. This is the load-bearing
 * proactive-recovery action behind [[feedback_premium_reliability_proactive]]:
 * the operator should never find out about an outage from a user.
 *
 * Why this is safe to fire autonomously:
 *
 *   1. Cooldown — we won't fire a restart within RESTART_COOLDOWN_MS
 *      of the previous attempt. Prevents the watchdog from
 *      restart-looping a broken deploy.
 *
 *   2. Healthy-recently gate — we only fire if the bot has been
 *      observed healthy within HEALTHY_LOOKBACK_MS. A cold deploy
 *      that has NEVER been green is more likely broken by code
 *      (the 2026-06-13 self-monitor incident) than by a transient
 *      crash. In that case, restarting just re-runs the same broken
 *      image — the operator needs to ship a fix. We back off and
 *      let the alert path handle it.
 *
 *   3. Attempt cap — RESTART_MAX_ATTEMPTS per outage. Above the cap
 *      we stop trying; alert path stays armed.
 *
 *   4. Operator DM after every attempt — successful or failed — so
 *      the operator knows the backup generator ran and what it did.
 *
 * Env vars required (set on the magpie-site Vercel project):
 *   RAILWAY_API_TOKEN     — personal token with Workspace > Deploy scope
 *   RAILWAY_SERVICE_ID    — UUID of the magpie-bot service
 *   RAILWAY_ENVIRONMENT_ID — UUID of the production environment
 *
 * Without all three set, this module no-ops (returns
 * { triggered: false, reason: "not_configured" }).
 */
import type { Pool } from "pg";

// Configurable via env. Defaults chosen so the bot has time to come
// back on its own from a brief blip (graceful restart, deploy
// rotation) before we kick it.
const AUTO_RESTART_THRESHOLD =
  Number(process.env.AUTO_RESTART_THRESHOLD_TICKS) || 3;     // ~3 min @ 60s cron
const RESTART_COOLDOWN_MS =
  Number(process.env.AUTO_RESTART_COOLDOWN_MS) || 10 * 60_000; // 10 min
const HEALTHY_LOOKBACK_MS =
  Number(process.env.AUTO_RESTART_HEALTHY_LOOKBACK_MS) || 30 * 60_000; // 30 min
const RESTART_MAX_ATTEMPTS =
  Number(process.env.AUTO_RESTART_MAX_ATTEMPTS) || 3;
const RAILWAY_GRAPHQL = "https://backboard.railway.com/graphql/v2";

export interface RestartDecision {
  triggered: boolean;
  reason: string;        // "not_configured" | "cooldown" | "no_recent_healthy" | "max_attempts" | "fired_success" | "fired_failure" | "below_threshold"
  detail?: string;
  attempt_no?: number;
}

/**
 * Mark the bot as healthy NOW. Called by the watchdog on every
 * green-ping tick. Used to gate the auto-restart decision so we
 * don't kick a deploy that has never been healthy in the first
 * place.
 */
export async function markBotHealthy(pool: Pool): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO bot_health_marker (id, last_known_healthy_at, updated_at)
            VALUES (1, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
              SET last_known_healthy_at = NOW(),
                  updated_at = NOW()`,
    );
  } catch {
    // Non-fatal — the next tick will retry. We never want a logging
    // write to break the watchdog itself.
  }
}

/**
 * Mark the bot's DB as degraded NOW. Called by the watchdog when the
 * /api/v1/health response indicates `checks.db === "degraded"` or
 * `checks.db === "fail"`. Used by tryAutoRestart's NEW guard to skip
 * the redeploy — restarting a bot whose DB is unreachable just
 * crash-loops on the first query, which makes the failure worse (it
 * chews more DB compute hours during the dead window).
 *
 * 2026-06-14 outage:
 *   Neon compute-quota was exhausted. Every bot query threw XX000.
 *   Bot crash-looped. If the auto-restart had been firing in that
 *   window it would have made the situation worse. This gate ensures
 *   that next time, the operator's existing DB-quota-guard page
 *   handles it without the watchdog piling on.
 */
const DB_DEGRADED_LOOKBACK_MS =
  Number(process.env.AUTO_RESTART_DB_DEGRADED_LOOKBACK_MS) || 15 * 60_000; // 15 min

export async function markBotDbDegraded(pool: Pool): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO bot_health_marker (id, last_db_degraded_at, updated_at)
            VALUES (1, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE
              SET last_db_degraded_at = NOW(),
                  updated_at = NOW()`,
    );
  } catch {
    /* non-fatal */
  }
}

/**
 * Decide whether to fire an auto-restart and (if so) fire it.
 *
 * Returns a RestartDecision describing what happened. The watchdog
 * route appends the decision into its operator alert so the operator
 * sees what the backup generator did.
 */
export async function tryAutoRestart(
  pool: Pool,
  args: { outageId: number; consecutiveFailures: number },
): Promise<RestartDecision> {
  if (args.consecutiveFailures < AUTO_RESTART_THRESHOLD) {
    return { triggered: false, reason: "below_threshold" };
  }

  const token   = process.env.RAILWAY_API_TOKEN;
  const svcId   = process.env.RAILWAY_SERVICE_ID;
  const envId   = process.env.RAILWAY_ENVIRONMENT_ID;
  if (!token || !svcId || !envId) {
    return { triggered: false, reason: "not_configured", detail: "RAILWAY_API_TOKEN/SERVICE_ID/ENVIRONMENT_ID not all set" };
  }

  // ── Read state ──
  const { rows: stateRows } = await pool.query<{
    last_restart_at: string | null;
    restart_count: number;
  }>(
    `SELECT last_restart_at, restart_count
       FROM tg_outage_state
      WHERE id = $1`,
    [args.outageId],
  );
  const state = stateRows[0] ?? { last_restart_at: null, restart_count: 0 };

  if (state.restart_count >= RESTART_MAX_ATTEMPTS) {
    return {
      triggered: false,
      reason: "max_attempts",
      detail: `${state.restart_count}/${RESTART_MAX_ATTEMPTS} restart attempts already used for outage #${args.outageId}`,
    };
  }
  if (state.last_restart_at) {
    const ageMs = Date.now() - new Date(state.last_restart_at).getTime();
    if (ageMs < RESTART_COOLDOWN_MS) {
      return {
        triggered: false,
        reason: "cooldown",
        detail: `last restart ${Math.round(ageMs / 1000)}s ago; cooldown ${RESTART_COOLDOWN_MS / 1000}s`,
      };
    }
  }

  // ── Healthy-recently gate AND DB-degraded-recently gate ──
  // Read both markers in one query — they live on the same row.
  const { rows: hmRows } = await pool.query<{
    last_known_healthy_at: string | null;
    last_db_degraded_at: string | null;
  }>(`SELECT last_known_healthy_at, last_db_degraded_at
        FROM bot_health_marker WHERE id = 1`);
  const healthyAt = hmRows[0]?.last_known_healthy_at ?? null;
  const dbDegradedAt = hmRows[0]?.last_db_degraded_at ?? null;
  if (!healthyAt) {
    return { triggered: false, reason: "no_recent_healthy", detail: "bot has never been observed healthy" };
  }
  const healthyAgeMs = Date.now() - new Date(healthyAt).getTime();
  if (healthyAgeMs > HEALTHY_LOOKBACK_MS) {
    return {
      triggered: false,
      reason: "no_recent_healthy",
      detail: `last healthy ${Math.round(healthyAgeMs / 60_000)}m ago; lookback ${HEALTHY_LOOKBACK_MS / 60_000}m`,
    };
  }
  // NEW gate (2026-06-14): if the bot reported DB-degraded recently,
  // restarting won't help. The bot's db-quota-guard is paging the
  // operator; let it handle recovery. Bouncing the process just
  // crash-loops on the first query and chews more DB compute.
  if (dbDegradedAt) {
    const dbDegradedAgeMs = Date.now() - new Date(dbDegradedAt).getTime();
    if (dbDegradedAgeMs < DB_DEGRADED_LOOKBACK_MS) {
      return {
        triggered: false,
        reason: "db_degraded_recent",
        detail: `bot reported DB degraded ${Math.round(dbDegradedAgeMs / 60_000)}m ago; restart would just crash-loop on dead DB. Operator is paged via the bot's own DB-quota-guard. Lookback ${DB_DEGRADED_LOOKBACK_MS / 60_000}m.`,
      };
    }
  }

  // ── Fire ──
  const attemptNo = (state.restart_count ?? 0) + 1;
  const outcome = await callRailwayRedeploy({
    token, serviceId: svcId, environmentId: envId,
  });

  await pool.query(
    `UPDATE tg_outage_state
        SET last_restart_at = NOW(),
            last_restart_outcome = $2,
            restart_count = restart_count + 1
      WHERE id = $1`,
    [args.outageId, outcome.ok ? `fired_success: ${outcome.detail}` : `fired_failure: ${outcome.detail}`],
  );

  return {
    triggered: true,
    reason: outcome.ok ? "fired_success" : "fired_failure",
    detail: outcome.detail,
    attempt_no: attemptNo,
  };
}

interface RedeployResult { ok: boolean; detail: string; }

async function callRailwayRedeploy(args: {
  token: string;
  serviceId: string;
  environmentId: string;
}): Promise<RedeployResult> {
  // serviceInstanceRedeploy mutation:
  // Redeploys the latest deployment of (serviceId, environmentId).
  // Idempotent in the sense that calling it twice quickly just
  // queues a second redeploy on top of the first.
  const query = `
    mutation Redeploy($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }
  `;
  try {
    const res = await fetch(RAILWAY_GRAPHQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${args.token}`,
      },
      body: JSON.stringify({
        query,
        variables: { serviceId: args.serviceId, environmentId: args.environmentId },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, detail: `http_${res.status}: ${body.slice(0, 160)}` };
    }
    const json = await res.json().catch(() => ({} as { errors?: { message: string }[] }));
    if (Array.isArray(json?.errors) && json.errors.length > 0) {
      return { ok: false, detail: `graphql_error: ${json.errors[0]?.message?.slice(0, 160)}` };
    }
    return { ok: true, detail: "redeploy queued" };
  } catch (err) {
    return { ok: false, detail: (err as Error).message?.slice(0, 160) || "fetch_failed" };
  }
}
