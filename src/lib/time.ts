/**
 * Time formatting helpers — all human-facing displays render in EST
 * (America/New_York).
 *
 * Operator-stated rule: the protocol's user is based in Eastern Time
 * and finds UTC/GMT timestamp displays confusing. Storage and backend
 * math stay in UTC ISO strings so DST transitions don't shift the
 * actual moment of any event; only the human-facing display converts.
 *
 * The `timeZoneName: "short"` option automatically picks EDT (during
 * daylight saving) or EST (standard) based on the instant being
 * formatted — never hardcode the suffix yourself.
 */

const EST_ZONE = "America/New_York";

function toDate(input: string | Date): Date {
  return typeof input === "string" ? new Date(input) : input;
}

/**
 * "Jun 12, 2026, 4:35 PM EDT" — the canonical display format for
 * any absolute timestamp on the site.
 */
export function formatEst(input: string | Date): string {
  return toDate(input).toLocaleString("en-US", {
    timeZone: EST_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/**
 * "Jun 12, 2026" — date-only display. Use when the time of day isn't
 * meaningful (e.g. loan opened-on dates).
 */
export function formatEstDate(input: string | Date): string {
  return toDate(input).toLocaleDateString("en-US", {
    timeZone: EST_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * "4:35 PM EDT" — time-only display with the EDT/EST suffix.
 */
export function formatEstTime(input: string | Date): string {
  return toDate(input).toLocaleString("en-US", {
    timeZone: EST_ZONE,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
