/**
 * Strike-price parser (site copy).
 *
 * Byte-equivalent port of magpie-bot/src/lib/strike-price-parser.js so
 * the dashboard's free-text strike input behaves IDENTICALLY to TG /tp
 * and Pip's target_text. Operator UX mandate (2026-06-14): "17M mc",
 * "17,000,000 MC", "17 million market cap" all resolve the same way.
 *
 * If you change the JS parser in magpie-bot, change this file the same
 * day. The cross-surface consistency is the whole point.
 */

const MAGNITUDE_WORDS = new Map<string, number>([
  ["k", 1_000], ["thousand", 1_000],
  ["m", 1_000_000], ["mil", 1_000_000], ["mm", 1_000_000], ["million", 1_000_000],
  ["b", 1_000_000_000], ["bn", 1_000_000_000], ["bil", 1_000_000_000], ["billion", 1_000_000_000],
  ["t", 1_000_000_000_000], ["tn", 1_000_000_000_000], ["trillion", 1_000_000_000_000],
]);

const MC_WORDS = new Set(["mc", "mcap", "marketcap", "mktcap", "market", "market_cap", "mkt_cap", "mc_usd"]);
const PRICE_USD_WORDS = new Set(["price", "usd", "dollars", "dollar", "usdc", "cents", "cent", "price_usd"]);
const PRICE_SOL_WORDS = new Set(["sol", "lamports", "lamport", "price_sol"]);

const MIN_MICRO = 1n;
const MAX_MICRO = 1_000_000_000_000_000n;

export type StrikeKind = "mc_usd" | "price_usd" | "price_sol" | "multiplier";

export interface ParseStrikeResult {
  ok: true;
  kind: StrikeKind;
  valueMicro: bigint | null;
  multiplier: number | null;
  impliedDirection: "above" | "below" | null;
  normalizedDisplay: string;
}

export interface ParseStrikeError {
  ok: false;
  error: string;
  examples?: string[];
}

export interface ParseStrikeOpts {
  bareNumberDefaultKind?: "mc_usd" | "price_usd";
}

function normalizeInput(s: string): string {
  return s.trim().toLowerCase().replace(/ /g, " ").replace(/\s+/g, " ");
}
function stripFormattingChars(numStr: string): string {
  return numStr.replace(/[,_]/g, "");
}

function parsePercentMove(s: string): { ok: true; multiplier: number; direction: "above" | "below" } | null {
  let m = s.match(/^down\s+([0-9]+(?:\.[0-9]+)?)\s*%$/);
  if (m) return { ok: true, multiplier: 1 - Number(m[1]) / 100, direction: "below" };
  m = s.match(/^up\s+([0-9]+(?:\.[0-9]+)?)\s*%$/);
  if (m) return { ok: true, multiplier: 1 + Number(m[1]) / 100, direction: "above" };
  m = s.match(/^[-]\s*([0-9]+(?:\.[0-9]+)?)\s*%$/);
  if (m) return { ok: true, multiplier: 1 - Number(m[1]) / 100, direction: "below" };
  m = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*%\s*down$/);
  if (m) return { ok: true, multiplier: 1 - Number(m[1]) / 100, direction: "below" };
  m = s.match(/^[+]\s*([0-9]+(?:\.[0-9]+)?)\s*%$/);
  if (m) return { ok: true, multiplier: 1 + Number(m[1]) / 100, direction: "above" };
  m = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*%\s*up$/);
  if (m) return { ok: true, multiplier: 1 + Number(m[1]) / 100, direction: "above" };
  return null;
}

function parseMultiplier(s: string): number | null {
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*x$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function extractLeadingNumber(s: string): { num: number; rest: string } | null {
  const m = s.match(/^\$?\s*([0-9][0-9_,]*(?:\.[0-9]+)?)\s*(.*)$/);
  if (!m) return null;
  const raw = stripFormattingChars(m[1]);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return { num: n, rest: m[2].trim() };
}

function extractMagnitudeWord(rest: string): { factor: number; rest: string } {
  if (!rest) return { factor: 1, rest: "" };
  const tokens = rest.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { factor: 1, rest: "" };
  const head = tokens[0].toLowerCase().replace(/[.,!?]$/, "");
  if (MAGNITUDE_WORDS.has(head)) {
    return { factor: MAGNITUDE_WORDS.get(head)!, rest: tokens.slice(1).join(" ") };
  }
  return { factor: 1, rest };
}

function extractKindWord(rest: string): { kind: StrikeKind | null; rest: string } {
  if (!rest) return { kind: null, rest: "" };
  const lower = rest.toLowerCase();
  const mcMatch = lower.match(/^(market\s*cap|market_cap)\b\s*(.*)/);
  if (mcMatch) return { kind: "mc_usd", rest: mcMatch[2].trim() };
  const tokens = lower.split(/\s+/).filter(Boolean);
  const head = tokens[0]?.replace(/[.,!?]$/, "");
  if (!head) return { kind: null, rest: "" };
  if (MC_WORDS.has(head)) return { kind: "mc_usd", rest: tokens.slice(1).join(" ") };
  if (PRICE_USD_WORDS.has(head)) return { kind: "price_usd", rest: tokens.slice(1).join(" ") };
  if (PRICE_SOL_WORDS.has(head)) return { kind: "price_sol", rest: tokens.slice(1).join(" ") };
  return { kind: null, rest };
}

function fmtDisplayMc(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B MC`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M MC`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(1)}K MC`;
  return `$${usd.toFixed(2)} MC`;
}
function fmtDisplayUsd(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(usd >= 100 ? 0 : 2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(8).replace(/0+$/, "0")}`;
}

function toMicro(num: number): bigint | null {
  const micro = BigInt(Math.round(num * 1e6));
  if (micro < MIN_MICRO || micro > MAX_MICRO) return null;
  return micro;
}

export function parseStrike(raw: string, opts: ParseStrikeOpts = {}): ParseStrikeResult | ParseStrikeError {
  const norm = normalizeInput(raw);
  if (!norm) {
    return { ok: false, error: "Empty target. Try `17m mc` or `$0.005` or `2x`." };
  }
  const pct = parsePercentMove(norm);
  if (pct) {
    return {
      ok: true, kind: "multiplier", valueMicro: null, multiplier: pct.multiplier,
      impliedDirection: pct.direction,
      normalizedDisplay: `${pct.multiplier > 1 ? "+" : ""}${((pct.multiplier - 1) * 100).toFixed(1)}% (${pct.direction === "above" ? "TP" : "SL"})`,
    };
  }
  const mult = parseMultiplier(norm);
  if (mult != null) {
    const dir: "above" | "below" = mult >= 1 ? "above" : "below";
    return {
      ok: true, kind: "multiplier", valueMicro: null, multiplier: mult,
      impliedDirection: dir,
      normalizedDisplay: `${mult}x (${dir === "above" ? "TP" : "SL"})`,
    };
  }
  const numHead = extractLeadingNumber(norm);
  if (!numHead) {
    return {
      ok: false,
      error: `Couldn't parse "${raw}". Try \`17m mc\` (market cap), \`$0.005\` (price), or \`2x\` (multiplier).`,
      examples: ["17m mc", "$0.005", "2x", "down 30%"],
    };
  }
  const { num, rest: afterNum } = numHead;
  const { factor, rest: afterFactor } = extractMagnitudeWord(afterNum);
  const adjustedNum = num * factor;
  const { kind: explicitKind, rest: afterKind } = extractKindWord(afterFactor);
  if (afterKind && afterKind.length > 0) {
    return { ok: false, error: `Trailing text after target: "${afterKind}". Try \`17m mc\` (just the value).` };
  }
  let kind: StrikeKind = explicitKind ?? (opts.bareNumberDefaultKind ?? (adjustedNum >= 100_000 ? "mc_usd" : "price_usd"));
  if (adjustedNum <= 0) return { ok: false, error: "Target must be positive." };
  if (kind === "price_sol") {
    const lamports = BigInt(Math.round(adjustedNum * 1e9));
    if (lamports < MIN_MICRO || lamports > MAX_MICRO) return { ok: false, error: "Target out of range." };
    return {
      ok: true, kind: "price_sol", valueMicro: lamports, multiplier: null, impliedDirection: null,
      normalizedDisplay: `${adjustedNum.toFixed(6)} SOL`,
    };
  }
  const micro = toMicro(adjustedNum);
  if (!micro) return { ok: false, error: "Target out of range." };
  return {
    ok: true, kind, valueMicro: micro, multiplier: null, impliedDirection: null,
    normalizedDisplay: kind === "mc_usd" ? fmtDisplayMc(adjustedNum) : fmtDisplayUsd(adjustedNum),
  };
}
