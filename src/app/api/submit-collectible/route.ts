import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Connection, PublicKey } from "@solana/web3.js";
import { query } from "@/lib/db";
import { vetSubmission, GATE_VERSION, normGrader, type Submission } from "@/lib/collectible-vetting";

/**
 * Collector-facing submission endpoint for the collectibles book.
 *
 * POST — run the SAME gate the launch allowlist was built from (design repo
 *        doc 26 V-1..V-7) and record the attempt.
 * GET  — return the caller's OWN submissions for their dashboard, public
 *        columns only.
 *
 * Storage lives in `collectible_submissions` (bot migration 097), which keeps
 * one row per attempt so a cert resubmitted under a different wallet stays
 * visible as the fraud signal it is.
 *
 * Two rules this file exists to enforce:
 *   1. Everything the collector types is attacker-controlled. It is length-
 *      capped, and MarkdownV2-escaped before it can reach the operator's
 *      Telegram (same class as audit finding S3 on /api/submit-token).
 *   2. Internal columns — reviewer_note, ip_hash, ua_hash, flags — NEVER
 *      leave the protocol. The SELECT below is an explicit column list, not
 *      a `SELECT *`, so adding an internal column later can't silently start
 *      leaking it.
 */

const ADMIN_TG_ID = process.env.ADMIN_TELEGRAM_ID ?? "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

/**
 * Salt for the provenance hashes. We store a salted hash of IP/user-agent for
 * abuse detection and never the raw values; without a salt the hash of an IPv4
 * address is trivially reversible by brute force.
 */
const HASH_SALT = process.env.SUBMISSION_HASH_SALT ?? "";

/**
 * The rate limiter keys on the SALTED ip hash, so no salt means no key means no
 * limit. That must never happen quietly on a public write endpoint: the salt is
 * a deploy-time secret and removing it would otherwise turn throttling off with
 * nothing in the logs. This is the explicit flag the limiter is gated on, and
 * POST refuses outright when it is false.
 */
const RATE_LIMITING_ENABLED = HASH_SALT.length > 0;

const MAX_FIELD = 120;

/** Submissions per IP per hour. Generous for a real collector, useless for a bot. */
const RATE_LIMIT_PER_HOUR = 20;

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed",
);

/**
 * The one control on this endpoint that a liar cannot talk their way past.
 *
 * Everything else on the form is self-reported — a scammer can type any cert,
 * any grade, any card, including details copied from someone else's real
 * listing. But if they name the tokenized card, we can ask the chain whether
 * THIS wallet actually holds it.
 *
 * Returns "proven" only on a positive balance. Anything else is "unproven"
 * (we couldn't check) or "mismatch" (we checked and they don't hold it) —
 * and mismatch is treated as a fraud signal, not a formatting mistake.
 */
async function verifyOwnership(
  mint: string,
  wallet: string,
): Promise<"proven" | "unproven" | "mismatch"> {
  if (!mint || !wallet) return "unproven";
  try {
    const accounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(wallet),
      { mint: new PublicKey(mint) },
    );
    const held = accounts.value.some((a) => {
      const amt = a.account.data.parsed?.info?.tokenAmount?.uiAmount;
      return typeof amt === "number" && amt > 0;
    });
    return held ? "proven" : "mismatch";
  } catch {
    // RPC down or malformed address — never turn an infrastructure failure
    // into an accusation.
    return "unproven";
  }
}

function clean(v: unknown): string {
  if (v == null) return "";
  // Strip control characters, collapse whitespace, cap length.
  return String(v)
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FIELD);
}

function escapeMd(s: string): string {
  return String(s ?? "").replace(/[_*`[\]()~>#+\-=|{}.!\\]/g, "\\$&").slice(0, MAX_FIELD);
}

/** Salted, truncated — enough to correlate abuse, useless for identifying a person. */
function saltedHash(v: string | null): string | null {
  if (!v || !HASH_SALT) return null;
  return createHash("sha256").update(`${HASH_SALT}:${v}`).digest("hex").slice(0, 32);
}

/** Base58, 32-44 chars. Rejects anything that isn't a plausible Solana address. */
function cleanWallet(v: unknown): string {
  const s = clean(v);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) ? s : "";
}

async function notifyAdmin(text: string) {
  if (!BOT_TOKEN || !ADMIN_TG_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_TG_ID, text, parse_mode: "MarkdownV2" }),
    });
  } catch {
    /* non-critical — never fail a submission because Telegram is down */
  }
}

/* ── GET: a collector's own submissions, for the dashboard ─────────────── */

export async function GET(req: Request) {
  const wallet = cleanWallet(new URL(req.url).searchParams.get("wallet"));
  if (!wallet) return NextResponse.json({ submissions: [] });

  try {
    // Explicit column list — internal columns are not in scope here by
    // construction, so a future internal column can't leak by accident.
    // NOTE: passing ?wallet= is a CLAIM, not proof — nothing here verifies the
    // caller controls that wallet, and wallets are public. So this must not
    // return anything that turns a public address into a targeting record for a
    // valuable physical object. The cert is the slab's unique identifier, so it
    // is masked to the last 4 digits: enough for the owner to tell their own
    // submissions apart, useless for enumerating someone else's collection.
    // The real fix is a signed-message login; until then, mask.
    const { rows } = await query(
      `SELECT id, card, card_set, card_year, grader,
              RIGHT(regexp_replace(cert, '\\D', '', 'g'), 4) AS cert_last4,
              grade, auto_grade,
              platform, verdict, tier, status, checks, next_steps, created_at
         FROM collectible_submissions
        WHERE wallet = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [wallet],
    );
    return NextResponse.json({ submissions: rows });
  } catch {
    // Table not migrated yet, or DB unreachable — an empty history is the
    // right degradation for a dashboard panel.
    return NextResponse.json({ submissions: [] });
  }
}

/* ── POST: vet a card and record the attempt ───────────────────────────── */

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const sub: Submission = {
    grader: clean(body.grader),
    cert: clean(body.cert),
    card: clean(body.card),
    set: clean(body.set),
    year: clean(body.year),
    grade: clean(body.grade),
    autoGrade: clean(body.autoGrade),
    platform: clean(body.platform),
    contact: clean(body.contact),
  };
  const wallet = cleanWallet(body.wallet);
  const mint = cleanWallet(body.mint); // same base58 shape as a wallet

  if (!sub.card) {
    return NextResponse.json({ error: "Tell us which card it is." }, { status: 400 });
  }

  // The gate is pure and synchronous — a verdict never depends on the DB or
  // Telegram being reachable.
  const result = vetSubmission(sub);

  const ipHash = saltedHash(
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null,
  );
  const uaHash = saltedHash(req.headers.get("user-agent"));

  // Fail CLOSED when throttling is unavailable. An unthrottled public endpoint
  // that writes rows is worse than a form that is briefly unavailable, and the
  // pool is not live, so nothing time-critical depends on this path.
  if (!RATE_LIMITING_ENABLED) {
    await notifyAdmin(
      "*Collectible submissions PAUSED* — `SUBMISSION_HASH_SALT` is unset, so the rate limiter has no key\\. Submissions are refused until it is restored\\.",
    );
    return NextResponse.json(
      { error: "Submissions are briefly unavailable. Please try again shortly." },
      { status: 503 },
    );
  }

  // Rate limit before doing any real work.
  if (ipHash) {
    try {
      const { rows } = await query(
        `SELECT COUNT(*)::int AS n
           FROM collectible_submissions
          WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [ipHash],
      );
      if ((rows[0]?.n ?? 0) >= RATE_LIMIT_PER_HOUR) {
        return NextResponse.json(
          { error: "That's a lot of submissions in one go. Try again shortly." },
          { status: 429 },
        );
      }
    } catch {
      /* limiter is best-effort; never lock a real collector out on a DB blip */
    }
  }

  // Ownership: the only claim on this form we can actually test.
  const ownership = await verifyOwnership(mint, wallet);

  // Abuse + integrity signals. Internal only.
  const flags: Record<string, unknown> = { ownership, self_reported: true };
  if (mint) flags.mint = mint;
  try {
    const digits = sub.cert.replace(/\D/g, "");
    if (digits) {
      // Match on the cert DIGITS only, then compare graders in JS through the
      // same normalisation the gate uses. Matching `grader = $1` in SQL meant
      // "PSA" and "psa" were different graders, so re-submitting the same slab
      // under a different capitalisation evaded the very signal this exists to
      // raise. Legacy rows hold un-normalised graders, which this also handles.
      const { rows: certRows } = await query(
        `SELECT wallet, grader, created_at
           FROM collectible_submissions
          WHERE regexp_replace(cert, '\\D', '', 'g') = $1
          ORDER BY created_at DESC
          LIMIT 20`,
        [digits],
      );
      const wantGrader = normGrader(sub.grader);
      const rows = certRows.filter(
        (r: { grader: string | null }) => normGrader(r.grader ?? "") === wantGrader,
      );
      if (rows.length) {
        flags.cert_seen_before = true;
        flags.prior_attempts = rows.length;
        // The one that matters: the same slab claimed by a different wallet.
        const others = rows.filter(
          (r: { wallet: string | null }) => r.wallet && r.wallet !== wallet,
        );
        if (others.length) flags.cert_claimed_by_other_wallet = true;
      }
    }
  } catch {
    /* signal is best-effort; never block a submission on it */
  }

  try {
    await query(
      `INSERT INTO collectible_submissions
         (wallet, contact, grader, cert, card, card_set, card_year, grade, auto_grade,
          platform, verdict, tier, checks, next_steps, gate_version, source,
          ip_hash, ua_hash, flags)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'site',$16,$17,$18)`,
      [
        wallet || null,
        sub.contact || null,
        normGrader(sub.grader), // canonical, so the duplicate-cert signal can't be dodged
        sub.cert,
        sub.card,
        sub.set || null,
        sub.year || null,
        sub.grade || null,
        sub.autoGrade || null,
        sub.platform || null,
        result.verdict,
        result.tier,
        JSON.stringify(result.checks),
        JSON.stringify(result.next),
        GATE_VERSION,
        ipHash,
        uaHash,
        JSON.stringify(flags),
      ],
    );
  } catch {
    /* non-critical — the collector still gets their answer */
  }

  // Surface what needs a human. Declines are noise; a contested cert is not.
  if (
    result.verdict !== "DECLINED" ||
    flags.cert_claimed_by_other_wallet ||
    ownership === "mismatch"
  ) {
    await notifyAdmin(
      [
        `*Collectible submission* — ${escapeMd(result.verdict)}`,
        `Card: ${escapeMd(sub.card)}`,
        `Slab: ${escapeMd(sub.grader)} ${escapeMd(sub.cert)}` +
          (sub.grade ? ` · grade ${escapeMd(sub.grade)}` : "") +
          (sub.autoGrade ? ` · auto ${escapeMd(sub.autoGrade)}` : ""),
        sub.platform ? `Vault: ${escapeMd(sub.platform)}` : "Vault: not yet vaulted",
        wallet ? `Wallet: ${escapeMd(wallet)}` : "Wallet: not connected",
        sub.contact ? `Contact: ${escapeMd(sub.contact)}` : "",
        flags.cert_claimed_by_other_wallet
          ? "\n⚠️ This cert has been submitted by a DIFFERENT wallet before\\."
          : "",
        ownership === "proven"
          ? "✅ On\\-chain ownership confirmed\\."
          : ownership === "mismatch"
            ? "\n⚠️ Wallet does NOT hold the token they named\\."
            : "",
        "",
        "Still needs the sold\\-comp check before it can back a loan\\.",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  // Ownership changes the answer. A card the wallet demonstrably does NOT
  // hold can never be provisionally eligible, whatever the slab says.
  if (ownership === "mismatch") {
    result.checks.push({
      name: "You hold this card",
      pass: false,
      detail:
        "The wallet you're connected with doesn't currently hold that token. We can only lend against a card you actually hold.",
    });
    if (result.verdict.startsWith("PROVISIONAL")) {
      result.verdict = "CANDIDATE_REVIEW";
      result.tier = null;
      result.headline = "We couldn't confirm you hold this card.";
    }
    result.next = [
      "Submit from the wallet that holds the tokenized card, or double-check the mint address.",
      ...result.next,
    ];
  } else if (ownership === "proven") {
    result.checks.push({
      name: "You hold this card",
      pass: true,
      detail: "Confirmed on-chain — this wallet holds that token.",
    });
  }

  return NextResponse.json(result);
}
