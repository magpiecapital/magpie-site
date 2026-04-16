export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="BagBank logo"
    >
      <defs>
        <linearGradient id="bagGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5cc4a" />
          <stop offset="100%" stopColor="#b88a1f" />
        </linearGradient>
        <linearGradient id="shineGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Outer rounded square */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#111110" stroke="#26261f" strokeWidth="1.5" />

      {/* Bag body */}
      <path
        d="M18 28 C18 24, 22 22, 26 22 L38 22 C42 22, 46 24, 46 28 L49 50 C49 54, 46 56, 42 56 L22 56 C18 56, 15 54, 15 50 Z"
        fill="url(#bagGrad)"
        stroke="#d4af37"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />

      {/* Bag tie / top cinch */}
      <path
        d="M23 22 Q24 17, 28 16 L36 16 Q40 17, 41 22"
        stroke="#26261f"
        strokeWidth="2.25"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="32" cy="16" r="2" fill="#26261f" />

      {/* Dollar sign */}
      <path
        d="M32 30 V46 M28.5 33.2 Q28.5 31, 31 31 H33.5 Q36 31, 36 33.2 Q36 35.4, 33.5 36 H30.5 Q28 36.6, 28 38.8 Q28 41, 30.5 41 H33 Q35.5 41, 35.5 38.8"
        stroke="#0a0a0a"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Shine */}
      <path
        d="M18 28 C18 24, 22 22, 26 22 L28 22 L24 56 L22 56 C18 56, 15 54, 15 50 Z"
        fill="url(#shineGrad)"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={36} />
      <span className="text-xl font-semibold tracking-tight">
        Bag<span className="text-[var(--gold-bright)]">Bank</span>
      </span>
    </div>
  );
}
