/**
 * Magpie brand mark.
 *
 * Silhouette-first design: a clean ivory magpie profile with a gold beak
 * and a tiny gold coin dot. Reads at 20px, reads at 120px.
 *
 *   <Mark />       — icon only (nav, favicon, social avatar)
 *   <Wordmark />   — icon + lowercase "magpie" wordmark
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
      {/* Silhouette — body + head + tail fused into one continuous fill */}
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
           Q 26 10, 28 10 Z"
        fill="#f5f1e6"
      />
      {/* Beak — gold triangular tip */}
      <path d="M 34 14 L 40 14.5 L 34 17 Z" fill="#e8c674" />
      {/* Eye */}
      <circle cx="30" cy="14" r="1.1" fill="#0a0a0b" />
      {/* Coin in the air near beak — the "shiny object" */}
      <circle cx="43" cy="13" r="2.2" fill="#e8c674" />
      <circle cx="42.3" cy="12.3" r="0.7" fill="#fff8d8" />
    </svg>
  );
}

export function Wordmark({ className = "", size = 32 }: { className?: string; size?: number }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Mark size={size} />
      <span
        className="text-[var(--paper)] font-medium tracking-[-0.03em]"
        style={{ fontSize: `${size * 0.62}px` }}
      >
        magpie
      </span>
    </div>
  );
}
