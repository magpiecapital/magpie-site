/**
 * POST /api/fallback/chat
 *
 * Pip's chat fallback. Runs entirely on Vercel using the Anthropic
 * API directly. When the bot's AI chat endpoint is unreachable,
 * Pip's client switches to this route so the user can still ASK
 * questions about Magpie — just can't take actions.
 *
 * Request body:
 *   {
 *     messages: [{ role: 'user' | 'assistant', content: string }, ...],
 *     wallet?: string,   // optional — used to enrich the system prompt
 *                        // with the user's on-chain loans so Pip can
 *                        // answer "what loans do I have"
 *   }
 *
 * Response: text/event-stream (SSE) with same shape as the bot's
 * streaming endpoint so the Pip client can consume it without
 * branching the parser:
 *   data: {"type":"chunk","text":"..."}
 *   data: {"type":"done"}
 *
 * Auth: light — the wallet param is asserted by the client but NOT
 * cryptographically verified. The fallback's threat model is "the
 * bot is down, give users SOMETHING that works." Worst case, an
 * unauthorized caller can read public on-chain data about another
 * wallet (already public on Solscan). No transactions, no PII, no
 * private bot data are accessible from this route — so unverified
 * wallet auth is acceptable.
 *
 * Rate limit: per-IP, max 10 requests / minute via in-process Map.
 */
import { MAGPIE_KNOWLEDGE_BASE } from "@/lib/pip-fallback-knowledge";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = process.env.PIP_FALLBACK_MODEL || "claude-haiku-4-5-20251001";
const MAX_TOKENS = 800;

// Per-IP rate limit. In-process state — resets on cold start, which
// is fine: the fallback is for emergencies, not sustained load.
const ipBuckets = new Map<string, number[]>();
const RPM_LIMIT = 10;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const minuteAgo = now - 60_000;
  const bucket = ipBuckets.get(ip) || [];
  const recent = bucket.filter((t) => t > minuteAgo);
  if (recent.length >= RPM_LIMIT) return true;
  recent.push(now);
  ipBuckets.set(ip, recent);
  return false;
}

function extractIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const first = xff.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function fetchUserLoansForContext(wallet: string, originUrl: string): Promise<string> {
  try {
    // Reuse the same fallback /loans endpoint — keeps logic single-sourced.
    const res = await fetch(`${originUrl}/api/fallback/loans?wallet=${encodeURIComponent(wallet)}`, {
      // 6s budget; if loans read is slow, fall through with no enrichment.
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return "";
    const body = await res.json();
    if (!body?.ok || !Array.isArray(body.loans) || body.loans.length === 0) {
      return `\n\n## Live data — User's loans (read on-chain just now)\nUser has no active loans on this wallet.`;
    }
    const summary = body.loans.slice(0, 10).map((l: Record<string, unknown>) =>
      `- loan_id=${l.loan_id} status=${l.status} owed_lamports=${l.repay_amount_lamports} collateral_mint=${(l.collateral_mint as string)?.slice(0, 12)}... due_at=${new Date(Number(l.due_at)).toISOString()}`,
    ).join("\n");
    return `\n\n## Live data — User's loans (read on-chain just now)\n${summary}`;
  } catch {
    return "";
  }
}

async function fetchPoolStatsForContext(originUrl: string): Promise<string> {
  try {
    const res = await fetch(`${originUrl}/api/fallback/pool`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return "";
    const body = await res.json();
    if (!body?.ok || !body.pool) return "";
    const p = body.pool;
    return `\n\n## Live data — Pool stats (read on-chain just now)\n` +
           `- total_deposits: ${p.total_deposits_sol?.toFixed(4)} SOL\n` +
           `- total_borrowed: ${p.total_borrowed_sol?.toFixed(4)} SOL\n` +
           `- available_liquidity: ${p.available_liquidity_sol?.toFixed(4)} SOL\n` +
           `- utilization: ${(p.utilization_rate * 100).toFixed(2)}%\n` +
           `- total_loans_issued: ${p.total_loans_issued}\n` +
           `- total_liquidations: ${p.total_liquidations}\n` +
           `- paused: ${p.paused}`;
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  // ── Config + rate limit ──
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "fallback_not_configured", detail: "ANTHROPIC_API_KEY not set on Vercel" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }
  const ip = extractIp(req);
  if (rateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: "rate_limited", detail: "max 10 req/min in fallback mode" }),
      { status: 429, headers: { "content-type": "application/json" } },
    );
  }

  // ── Body ──
  let body: { messages?: ChatMessage[]; wallet?: string };
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 }); }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  if (messages.length === 0) {
    return new Response(JSON.stringify({ error: "no_messages" }), { status: 400 });
  }
  // Validate each message has the expected shape.
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return new Response(JSON.stringify({ error: "invalid_message_shape" }), { status: 400 });
    }
    if (m.content.length > 4000) {
      return new Response(JSON.stringify({ error: "message_too_long", max: 4000 }), { status: 400 });
    }
  }
  const wallet = typeof body.wallet === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(body.wallet)
    ? body.wallet
    : null;

  // ── Build system prompt with live data ──
  const originUrl = new URL(req.url).origin;
  const [poolCtx, loansCtx] = await Promise.all([
    fetchPoolStatsForContext(originUrl),
    wallet ? fetchUserLoansForContext(wallet, originUrl) : Promise.resolve(""),
  ]);
  const systemPrompt = MAGPIE_KNOWLEDGE_BASE + poolCtx + loansCtx;

  // ── Stream from Anthropic ──
  // We translate Anthropic's SSE events into the same simple
  // {"type":"chunk","text":"..."} format the bot's streaming endpoint
  // emits, so the Pip client's parser doesn't need to branch.
  const anthropicRes = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
      stream: true,
    }),
  });

  if (!anthropicRes.ok || !anthropicRes.body) {
    const errText = await anthropicRes.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: "anthropic_upstream_failed", status: anthropicRes.status, detail: errText.slice(0, 500) }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicRes.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buf = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let lineEnd: number;
          while ((lineEnd = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, lineEnd).trim();
            buf = buf.slice(lineEnd + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              const evt = JSON.parse(data);
              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: "chunk", text: evt.delta.text })}\n\n`,
                ));
              } else if (evt.type === "message_stop") {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: "done", source: "fallback" })}\n\n`,
                ));
              }
            } catch { /* ignore malformed SSE line */ }
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: "error", message: (err as Error).message?.slice(0, 200) })}\n\n`,
        ));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-pip-mode": "fallback",
    },
  });
}
