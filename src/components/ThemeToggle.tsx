"use client";

/**
 * Theme toggle.
 *
 * Reads + writes localStorage("magpie-theme") = "light" | "dark" and
 * sets html[data-theme] so the CSS overrides in globals.css apply.
 *
 * Initial value is set by the pre-hydration script in layout.tsx
 * (ThemeScript) so the user never sees a flash of the wrong theme on
 * page load or hard refresh — even before React hydrates.
 */
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("magpie-theme");
  if (stored === "dark" || stored === "light") return stored;
  // First visit — respect OS preference.
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem("magpie-theme", theme);
  } catch {
    /* localStorage may be blocked — falling back to in-memory only. */
  }
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  // useState init isn't run on SSR for client components — but to keep
  // the button label correct after hydration we re-sync via effect.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  // Sync attribute → state when storage changes from another tab.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== "magpie-theme") return;
      const next = e.newValue === "dark" ? "dark" : "light";
      setTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`${theme === "dark" ? "Light" : "Dark"} mode`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-colors ${className}`}
    >
      {theme === "dark" ? (
        // Sun icon — currently dark, click to go light
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon icon — currently light, click to go dark
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
