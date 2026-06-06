/**
 * Magpie brand mark — flat silhouette.
 *
 * Light mode: black bird with amber coin (original brand).
 * Dark mode: soft baby blue silhouette so the mark stays visible
 *            against the near-black background.
 *
 * Pass `variant="static"` to keep the mark its original black
 * silhouette even in dark mode — useful for hero placements where
 * the surrounding artwork already provides contrast.
 */

export function Mark({
  size = 40,
  className = "",
  variant = "adaptive",
}: {
  size?: number;
  className?: string;
  variant?: "adaptive" | "static";
}) {
  // adaptive: uses currentColor + Tailwind dark: classes so the
  //           silhouette flips to baby-blue when the theme toggle is on.
  // static:   pins the fill to the brand black regardless of theme.
  const tintClass =
    variant === "static"
      ? "text-[#0a0a0a]"
      : "text-[#0a0a0a] dark:text-[#9bc7e0]";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${tintClass} ${className}`}
      aria-label="Magpie"
    >
      {/* Silhouette (body + head + long tail) — uses currentColor so
          the className above controls the tint. */}
      <path
        d="M 28 10
           Q 34 10, 34 15
           Q 34 18, 32 20
           Q 36 22, 35 27
           Q 33 34, 23 35
           Q 14 35, 10 29
           L 2 36
           Q 1 37, 2 38
           Q 3 39, 4 38
           L 13 32
           Q 17 28, 20 23
           Q 22 18, 24 14
           Q 26 10, 28 10 Z
           M 34 14 L 40 14.5 L 34 17 Z"
        fill="currentColor"
      />
      {/* Eye — punched-out dot. Page bg keeps it visible in both modes. */}
      <circle cx="30" cy="14" r="1" fill="var(--bg, #ffffff)" />
      {/* Coin — butter amber accent (warm in both themes) */}
      <circle cx="43" cy="13" r="2.4" fill="#f7c948" />
    </svg>
  );
}

export function Wordmark({ className = "", size = 32 }: { className?: string; size?: number }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Mark size={size} />
      <span
        className="font-semibold tracking-[-0.03em] text-[var(--ink)]"
        style={{ fontSize: `${size * 0.6}px` }}
      >
        magpie
      </span>
    </div>
  );
}
