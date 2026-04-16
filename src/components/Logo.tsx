/**
 * Magpie brand mark — pure flat silhouette.
 * Black bird, tiny electric-lime coin accent. Reads at 16px.
 */

export function Mark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Magpie"
    >
      {/* Silhouette (body + head + long tail) */}
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
        fill="#0a0a0a"
      />
      {/* Eye (negative space) */}
      <circle cx="30" cy="14" r="1" fill="#ffffff" />
      {/* Coin — butter amber accent */}
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
