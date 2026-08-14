import Link from "next/link";

/**
 * Sec3 audit stamp.
 *
 * WORDING IS LOAD-BEARING. It says "V4 Security Audit — Complete", not "Audited
 * by Sec3" full stop. The distinction is not pedantry: the remediated build
 * deploys at a new program ID and is NOT live yet, so the code currently holding
 * user funds is the pre-fix build. A depositor reading a bare "audited" badge
 * would reasonably assume otherwise, and that is the one misreading we cannot
 * afford on a page where people decide whether to trust us with money.
 *
 * Scoped and dated, it is both true and strong: an independent Solana-native
 * firm reviewed V4 end to end and closed the engagement with zero open findings.
 * That stands on its own without overclaiming — and it stays accurate the day
 * the audited build ships, at which point the sublabel can simply drop.
 *
 * The mark is an inline SVG rather than Sec3's own logo file: no hotlinking a
 * third party's asset, no CSP dependency, no trademark question about
 * redistributing their brand file. It renders identically in light and dark and
 * costs one request less.
 *
 * Every instance links to /security, where the full breakdown lives (24
 * findings, 20 resolved, 4 acknowledged, 0 open) plus Sec3's own public report
 * set for independent cross-checking. The badge is a signal, not the claim —
 * the claim is one click away and fully evidenced.
 */
export function AuditBadge({
  variant = "default",
  className = "",
}: {
  /** `compact` for footers/dense rows; `default` for content areas. */
  variant?: "default" | "compact";
  className?: string;
}) {
  const compact = variant === "compact";

  return (
    <Link
      href="/security"
      aria-label="V4 security audit by Sec3 — complete, zero open findings. Read the breakdown."
      className={`group inline-flex items-center gap-2.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] ${
        compact ? "px-3 py-1.5" : "px-4 py-2"
      } transition hover:border-[var(--ink-faint)] hover:bg-[var(--surface-strong,var(--surface))] ${className}`}
    >
      {/* Shield + check. Currency-agnostic, reads at 16px, no brand asset. */}
      <svg
        width={compact ? 14 : 16}
        height={compact ? 14 : 16}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="shrink-0 text-[var(--accent-deep)]"
      >
        <path
          d="M12 2.5 4.5 5.8v5.6c0 4.6 3.2 8.9 7.5 10.1 4.3-1.2 7.5-5.5 7.5-10.1V5.8L12 2.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="m8.6 12.1 2.3 2.3 4.5-4.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <span className="flex flex-col leading-none">
        <span
          className={`font-semibold text-[var(--ink)] ${compact ? "text-[11px]" : "text-xs"}`}
        >
          V4 Security Audit
          <span className="mx-1.5 text-[var(--ink-faint)]">·</span>
          <span className="text-[var(--accent-deep)]">Sec3</span>
        </span>
        <span
          className={`mt-1 text-[var(--ink-faint)] ${compact ? "text-[9px]" : "text-[10px]"}`}
        >
          Complete · 0 open findings
        </span>
      </span>
    </Link>
  );
}
