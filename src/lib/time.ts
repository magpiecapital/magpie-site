/**
 * Time formatting helpers — all human-facing displays render in EST
 * (America/New_York).
 *
 * Operator-stated rule: the protocol's user is based in Eastern Time
 * and finds UTC/GMT timestamp displays confusing. Storage and backend
 * math stay in UTC ISO strings so DST transitions don't shift the
 * actual moment of any event; only the human-facing display converts.
 *
 * Operator mandate (permanent, reaffirmed 2026-06-25): the suffix is ALWAYS
 * "EST" — the value is the correct America/New_York wall-clock time, but the
 * label reads "EST" year-round (never "EDT", never "UTC"). The operator treats
 * "EST" as the name for Eastern time and wants it uniform across the site. So we
 * format the wall-clock value in America/New_York and append " EST" ourselves
 * rather than using timeZoneName:"short" (which would print "EDT" in summer).
 */

const EST_ZONE = "America/New_York";

function toDate(input: string | Date): Date {
  return typeof input === "string" ? new Date(input) : input;
}

/**
 * "Jun 12, 2026, 4:35 PM EST" — the canonical display format for any absolute
 * timestamp on the site. Eastern wall-clock value, always labeled EST.
 */
export function formatEst(input: string | Date): string {
  return toDate(input).toLocaleString("en-US", {
    timeZone: EST_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) + " EST";
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
 * "4:35 PM EST" — time-only display, always labeled EST (see formatEst).
 */
export function formatEstTime(input: string | Date): string {
  return toDate(input).toLocaleString("en-US", {
    timeZone: EST_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }) + " EST";
}
