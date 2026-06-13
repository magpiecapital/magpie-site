/**
 * Outage-state tracking for the TG fallback.
 *
 * Why this lives in Postgres (not Vercel KV or in-process):
 *   - Vercel function instances are stateless (in-process map vanishes
 *     across cold starts), so we can't track "have we already DMed
 *     this user for this outage" in memory.
 *   - We already have a Postgres DB the bot uses. Adding state there
 *     is one less dependency than provisioning Vercel KV / Upstash.
 *   - The bot and the watchdog write to the same table, so we can
 *     coordinate: when the bot recovers, it clears the outage row
 *     and the watchdog stops DMing about it.
 *
 * Schema:
 *   tg_outage_alerts
 *     id           SERIAL PK
 *     outage_id    TEXT — unique per outage event (timestamp-based)
 *     user_id      INT  — references users(id)
 *     telegram_id  TEXT — denormalized for fast TG send
 *     alerted_at   TIMESTAMPTZ
 *     alert_kind   TEXT — 'down' | 'recovered'
 *
 *   tg_outage_state
 *     id           SERIAL PK
 *     started_at   TIMESTAMPTZ
 *     ended_at     TIMESTAMPTZ NULL — populated on recovery
 *     consecutive_failures INT
 *     last_check_at TIMESTAMPTZ
 *
 * Cron logic:
 *   1. Ping bot health.
 *   2. If down: increment consecutive_failures on current outage row
 *      (or create one). When failures reach OUTAGE_THRESHOLD, DM the
 *      RECENT_ACTIVE_USERS window once each (dedup via
 *      tg_outage_alerts).
 *   3. If up: if there's an open outage row (ended_at IS NULL),
 *      close it AND DM all previously-alerted users an all-clear.
 */
import { Pool } from "pg";

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    // Small pool for serverless. Vercel functions are short-lived;
    // we just need 1-2 connections per invocation.
    _pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 4_000,
      // The bot's DATABASE_URL uses sslmode=require; pg accepts it.
      // No additional ssl override needed.
    });
  }
  return _pool;
}

/**
 * Idempotent schema bootstrap. Runs once on first invocation per
 * cold start. The watchdog endpoint calls ensureSchema() defensively
 * so we don't need a separate migration in the bot repo.
 */
let _schemaEnsured = false;
export async function ensureSchema(): Promise<void> {
  if (_schemaEnsured) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tg_outage_state (
      id                   SERIAL PRIMARY KEY,
      started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at             TIMESTAMPTZ,
      consecutive_failures INT NOT NULL DEFAULT 1,
      last_check_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reason               TEXT
    );
    CREATE TABLE IF NOT EXISTS tg_outage_alerts (
      id          SERIAL PRIMARY KEY,
      outage_id   INT NOT NULL REFERENCES tg_outage_state(id),
      user_id     INT,
      telegram_id TEXT NOT NULL,
      alerted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      alert_kind  TEXT NOT NULL CHECK (alert_kind IN ('down','recovered'))
    );
    CREATE INDEX IF NOT EXISTS tg_outage_alerts_outage_kind_idx
      ON tg_outage_alerts(outage_id, alert_kind);
    CREATE INDEX IF NOT EXISTS tg_outage_state_open_idx
      ON tg_outage_state(ended_at) WHERE ended_at IS NULL;

    -- Auto-restart "backup generator" state. Added 2026-06-13 after
    -- the self-monitor.js duplicate-declaration outage. When the bot
    -- has been down for AUTO_RESTART_THRESHOLD ticks AND we haven't
    -- already kicked it in the recent past, the watchdog calls
    -- Railway's redeploy mutation. last_restart_at gates the attempt
    -- so we don't restart-loop a deploy that's broken by design.
    ALTER TABLE tg_outage_state
      ADD COLUMN IF NOT EXISTS last_restart_at      TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_restart_outcome TEXT,
      ADD COLUMN IF NOT EXISTS restart_count        INT NOT NULL DEFAULT 0;

    -- Singleton "last known healthy" timestamp. Lives in a one-row
    -- table so the watchdog can answer "was the bot ever healthy
    -- recently?" — protects against restart-looping a cold-deploy
    -- that's never been green. Single id so an UPSERT works.
    CREATE TABLE IF NOT EXISTS bot_health_marker (
      id                   INT  PRIMARY KEY DEFAULT 1,
      last_known_healthy_at TIMESTAMPTZ,
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (id = 1)
    );
    INSERT INTO bot_health_marker (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING;
  `);
  _schemaEnsured = true;
}
