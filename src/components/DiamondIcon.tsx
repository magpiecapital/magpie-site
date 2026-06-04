/**
 * Hand-drawn diamond icon — replaces the 💎 emoji used in $MAGPIE-holder
 * surfaces. Stroke-only, inherits `currentColor`, scales cleanly at any
 * size. Designed to read as a refined brand mark rather than an emoji.
 *
 * Usage:
 *   <DiamondIcon className="h-3.5 w-3.5" />
 *   <DiamondIcon className="h-4 w-4 text-[var(--accent)]" />
 */
export function DiamondIcon({
  className = "h-3.5 w-3.5",
  strokeWidth = 1.25,
  "aria-hidden": ariaHidden = true,
}: {
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
} = {}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden={ariaHidden}
    >
      {/* Outer diamond silhouette */}
      <path d="M5 9.5 L12 3 L19 9.5 L12 21 Z" />
      {/* Top facet line */}
      <path d="M5 9.5 L19 9.5" />
      {/* Inner facet lines — give it the cut/refraction feel */}
      <path d="M12 3 L9 9.5 L12 21" />
      <path d="M12 3 L15 9.5 L12 21" />
    </svg>
  );
}
