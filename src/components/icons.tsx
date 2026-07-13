/**
 * Shared line-icon set used across the site to replace low-effort emojis.
 *
 * All icons are:
 *   - Stroke-only (no fill except where explicitly noted)
 *   - Inherit `currentColor` so they pick up text/parent color
 *   - Sized via className (default h-3.5 w-3.5)
 *   - Pure SVG, no external deps
 *
 * Add new icons here rather than inlining SVG inside components, so
 * we keep one consistent visual vocabulary.
 */

type IconProps = { className?: string; strokeWidth?: number };

const base = (props: IconProps) => ({
  className: props.className ?? "h-3.5 w-3.5",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: props.strokeWidth ?? 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/** Down-right arrow — used for "borrow / disbursed" event icons. */
export function ArrowDownRightIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <path d="M7 7 L17 17" />
      <path d="M17 9 L17 17 L9 17" />
    </svg>
  );
}

/** Clean checkmark — used for "repaid / success / completed" indicators. */
export function CheckIcon(props: IconProps = {}) {
  return (
    <svg {...base({ ...props, strokeWidth: props.strokeWidth ?? 1.8 })}>
      <path d="M5 12 L10 17 L19 7" />
    </svg>
  );
}

/** Warning triangle — used for "alert / liquidation / error" indicators. */
export function TriangleAlertIcon(props: IconProps = {}) {
  return (
    <svg {...base({ ...props, strokeWidth: props.strokeWidth ?? 1.5 })}>
      <path d="M12 4 L21 19 L3 19 Z" />
      <path d="M12 10 L12 14" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Activity pulse line — neutral "live / updating" indicator. */
export function PulseIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <path d="M3 12 H8 L10 7 L14 17 L16 12 H21" />
    </svg>
  );
}

/** Gift box — used for "refer & earn", rewards, etc. */
export function GiftIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <path d="M4 11 H20 V20 H4 Z" />
      <path d="M2 7 H22 V11 H2 Z" />
      <path d="M12 7 V20" />
      <path d="M12 7 Q10 5 8 5 Q6 5 6 7 Q6 7.5 8 7 Z" />
      <path d="M12 7 Q14 5 16 5 Q18 5 18 7 Q18 7.5 16 7 Z" />
    </svg>
  );
}

/**
 * Status dot — small filled circle with optional ring. Used to replace
 * 🟢 🟡 🔴 emoji in status indicators. Color comes from currentColor or
 * a Tailwind text-color class on the parent.
 */
export function StatusDot({
  className = "h-2 w-2",
  ring = false,
}: {
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-hidden
    >
      <span
        className={`h-full w-full rounded-full ${
          ring ? "ring-2 ring-current ring-offset-1 ring-offset-transparent" : ""
        } bg-current`}
      />
    </span>
  );
}

/** Refresh / cycle arrow — neutral indicator for stats updates, etc. */
export function RefreshIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <path d="M4 12 a8 8 0 0 1 14 -5 L20 9" />
      <path d="M20 4 V9 H15" />
      <path d="M20 12 a8 8 0 0 1 -14 5 L4 15" />
      <path d="M4 20 V15 H9" />
    </svg>
  );
}

/** Shield with check — "zero liquidations / protected / safe" flagship stat. */
export function ShieldCheckIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 L20 6 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V6 Z" />
      <path d="M8.5 12 L11 14.5 L15.5 9.5" />
    </svg>
  );
}

/** Plain shield — "verify / security". */
export function ShieldIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 L20 6 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V6 Z" />
    </svg>
  );
}

/** Gauge / meter — "rate" stats (default rate, health). */
export function GaugeIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <path d="M4 19 a8 8 0 1 1 16 0" />
      <path d="M12 19 L15.5 10.5" />
      <circle cx="12" cy="19" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Two people — "users / community". */
export function UsersIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20 a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5 a3 3 0 0 1 0 5" />
      <path d="M17.5 14.5 a5.5 5.5 0 0 1 3 5" />
    </svg>
  );
}

/** Stacked layers — "loans / collateral in use". */
export function LayersIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 L21 8 L12 13 L3 8 Z" />
      <path d="M3 12 L12 17 L21 12" />
      <path d="M3 16 L12 21 L21 16" />
    </svg>
  );
}

/** Stacked coins — "borrow volume / SOL". */
export function CoinsIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6 V12 C5 13.7 8.1 15 12 15 C15.9 15 19 13.7 19 12 V6" />
      <path d="M5 12 V18 C5 19.7 8.1 21 12 21 C15.9 21 19 19.7 19 18 V12" />
    </svg>
  );
}

/** Lightning bolt — "auto-sell engine / agents / speed". */
export function BoltIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <path d="M13 3 L5 13 H11 L10 21 L19 10 H13 Z" />
    </svg>
  );
}

/** Flame — "burns / default economics". */
export function FlameIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 C15 7 17.5 9 17.5 13.5 A5.5 5.5 0 0 1 6.5 13.5 C6.5 11.5 7.5 10 8.5 9 C8.7 11 9.8 11.8 10.5 12 C10 9.5 11 5.5 12 3 Z" />
    </svg>
  );
}

/** Up-and-to-the-right trend — "growth". */
export function TrendUpIcon(props: IconProps = {}) {
  return (
    <svg {...base(props)}>
      <path d="M4 16 L10 10 L13 13 L20 6" />
      <path d="M15 6 H20 V11" />
    </svg>
  );
}
