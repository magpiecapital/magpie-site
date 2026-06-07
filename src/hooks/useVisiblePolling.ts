import { useEffect } from "react";

/**
 * Run `tick` every `intervalMs` ms, but pause when the document is
 * hidden (tab in background, window minimized). Also fires one
 * immediate `tick` when the user returns to the tab so the data is
 * fresh on return.
 *
 * Use this anywhere you'd otherwise write
 *   useEffect(() => { const id = setInterval(fn, X); return () => clearInterval(id); }, [...]);
 * to avoid wasting bandwidth + RPC/API quota on tabs the user isn't
 * looking at.
 *
 * The caller is responsible for running an initial fetch — this hook
 * only covers the interval-driven follow-ups + visibilitychange
 * re-fetch. (That keeps initial-render data flow in the caller's
 * useEffect with its own dep array.)
 *
 * SSR-safe — every document access is guarded.
 *
 * @param tick    The function to run on each tick. Should be stable
 *                (wrapped in useCallback if it captures state).
 * @param intervalMs    Poll interval in milliseconds.
 * @param deps    Dependencies — the hook re-arms whenever these change.
 *                Pass the same deps you'd put on the surrounding useEffect.
 */
export function useVisiblePolling(
  tick: () => void,
  intervalMs: number,
  deps: ReadonlyArray<unknown>,
) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const id = setInterval(() => {
      if (document.hidden) return;
      tick();
    }, intervalMs);

    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
