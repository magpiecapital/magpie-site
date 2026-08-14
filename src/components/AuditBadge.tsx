import Link from "next/link";
import Image from "next/image";

/**
 * Sec3 audit badge.
 *
 * Uses Sec3's OFFICIAL "Audited by Sec3" mark — the badge they publish in their
 * own reports repository for audited projects to display. Sec3 confirmed our
 * use of it directly (2026-08-14), so this is cleared, not merely assumed from
 * the fact that they publish it. Self-hosted at
 * /badges/audited-by-sec3.png rather than hotlinked from
 * user-images.githubusercontent.com: a hotlink can rot, adds a third-party
 * request on every page, and depends on a host we do not control.
 *
 * SCOPE LINE IS DELIBERATE. The official badge reads "Audited by Sec3", which is
 * Sec3's own attestation that the engagement happened — and it did. Our copy
 * next to it supplies the precision the image cannot: which program, and what
 * the outcome was. That matters because the remediated build deploys at a new
 * program ID and is not live yet, so the code holding user funds is still the
 * pre-fix build. The badge attests the review; the scope line keeps a depositor
 * from inferring more than the review actually covers.
 *
 * Every instance links to /security, where the full breakdown lives — 24
 * findings, 20 resolved, 4 acknowledged, 0 open — alongside Sec3's own public
 * report set for independent cross-checking. The badge is the signal; the
 * evidence is one click away.
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
  // Native asset is 312x80 (3.9:1). Keep the ratio exact so the mark never
  // distorts — a stretched auditor logo reads as a fake.
  const w = compact ? 156 : 195;
  const h = Math.round((w / 312) * 80);

  return (
    <Link
      href="/security"
      aria-label="Audited by Sec3 — V4 security audit complete, zero open findings. Read the breakdown."
      className={`group inline-flex flex-col gap-1.5 ${className}`}
    >
      <Image
        src="/badges/audited-by-sec3.png"
        alt="Audited by Sec3"
        width={w}
        height={h}
        className="opacity-95 transition group-hover:opacity-100"
        priority={false}
      />
      <span
        className={`text-[var(--ink-faint)] transition group-hover:text-[var(--ink-soft)] ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        V4 program · complete · 0 open findings
      </span>
    </Link>
  );
}
