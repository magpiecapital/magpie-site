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
