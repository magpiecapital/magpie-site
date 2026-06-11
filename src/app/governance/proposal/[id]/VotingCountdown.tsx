"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "closed";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function VotingCountdown({ closesAtIso }: { closesAtIso: string }) {
  const [remaining, setRemaining] = useState<string>("");

  useEffect(() => {
    const closesAt = new Date(closesAtIso).getTime();
    const tick = () => setRemaining(formatRemaining(closesAt - Date.now()));
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [closesAtIso]);

  if (!remaining) return null;
  return (
    <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-white/75">
      {remaining}
    </span>
  );
}
